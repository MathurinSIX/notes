import builtins
import logging
import uuid
from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any, TypeAlias

from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy.sql._typing import (
    _ColumnExpressionArgument,
)
from sqlalchemy.sql.expression import ColumnElement
from sqlmodel import SQLModel, func, or_, select

from app.api.deps import CurrentUser, SessionDep

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

RLS: TypeAlias = Callable[[uuid.UUID], _ColumnExpressionArgument[bool] | bool]
FilterFunction: TypeAlias = Callable[[Any], _ColumnExpressionArgument[bool] | bool]
SelectInloadFilterFunction: TypeAlias = Callable[[Any], Any]


class BaseRepository:
    model: type[SQLModel]
    options: list[Any] = []

    rls_select: RLS = lambda user_id: False
    rls_insert: RLS = lambda user_id: False
    rls_update: RLS = lambda user_id: False
    rls_delete: RLS = lambda user_id: False
    filters: dict[str, FilterFunction] = {}
    selectinload_filters: dict[str, SelectInloadFilterFunction] = {}
    order_by: dict[str, ColumnElement] = {}
    default_order_by: ColumnElement | None = None

    def __init__(
        self,
        session: SessionDep,
        current_user: CurrentUser,
    ) -> None:
        self.session: SessionDep = session
        self.current_user = current_user

    async def read_by_id(self, id: uuid.UUID, bypass_rls: bool = False):
        statement = (
            select(self.model)
            .options(*self.options)
            .where(
                self.model.id == id,  # type: ignore
                True
                if bypass_rls
                else or_(
                    self.current_user.is_superuser,
                    self.rls_select(self.current_user.id),
                ),
            )
        )
        result = await self.session.execute(statement)
        record = result.scalar_one_or_none()
        if not record:
            raise HTTPException(status_code=403)
        return record

    async def count(
        self, filters: dict[str, list[Any] | None], bypass_rls: bool = False
    ):
        statement = (
            select(func.count())
            .select_from(self.model)
            .where(
                True
                if bypass_rls
                else or_(
                    self.current_user.is_superuser,
                    self.rls_select(self.current_user.id),
                ),
                # Expecting filters
                *[
                    self.filters[name](values)
                    for name, values in filters.items()
                    if values is not None and name in self.filters
                ],
            )
        )
        records = await self.session.execute(statement)
        return records.scalar()

    async def list(
        self,
        filters: dict[str, list[Any] | None],
        skip: int | None = None,
        limit: int | None = None,
        bypass_rls: bool = False,
        order_by: str | None = None,
    ):
        statement = (
            select(self.model)
            .options(
                *[
                    *self.options,
                    # Expecting selectinload filters
                    *[
                        self.selectinload_filters[name](values)
                        for name, values in filters.items()
                        if values is not None and name in self.selectinload_filters
                    ],
                ]
            )
            .where(
                True
                if bypass_rls
                else or_(
                    self.current_user.is_superuser,
                    self.rls_select(self.current_user.id),
                ),
                # Expecting filters
                *[
                    self.filters[name](values)
                    for name, values in filters.items()
                    if values is not None and name in self.filters
                ],
            )
            .offset(skip)
            .limit(limit)
            .order_by(
                self.order_by[order_by]
                if order_by in self.order_by
                else (
                    self.default_order_by
                    if self.default_order_by is not None
                    else self.model.updated_ts.desc()
                )
            )
        )
        records = await self.session.execute(statement)
        return records.scalars().all()

    async def create(self, data: BaseModel, bypass_rls: bool = False):
        dumped_data = data.model_dump(exclude_unset=True)
        new_record = self.model.model_validate(dumped_data)
        self.session.add(new_record)

        await self.session.flush()

        # Verify RLS
        statement = select(self.model).where(
            self.model.id == new_record.id,  # type: ignore
            True
            if bypass_rls
            else or_(
                self.current_user.is_superuser,
                self.rls_insert(self.current_user.id),
            ),
        )
        result = await self.session.execute(statement)
        record = result.scalar_one_or_none()
        if not record:
            raise HTTPException(status_code=403)

        await self.session.commit()
        await self.session.refresh(record)
        return await self.read_by_id(new_record.id, bypass_rls=True)

    async def create_by_batch(
        self,
        data_list: builtins.list[BaseModel],
        bypass_rls: bool = False,
        batch_size: int = 50,
    ):
        # Iterate batches lazily to avoid materializing the entire input in memory
        for batch in self.pool(data_list, batch_size):
            # Validate and prepare new records
            new_records = [
                self.model.model_validate(data.model_dump(exclude_unset=True))
                for data in batch
            ]
            self.session.add_all(new_records)

            await self.session.flush()

            # Build a statement to select all inserted records that pass RLS
            ids = [rec.id for rec in new_records]
            statement = (
                select(func.count())
                .select_from(self.model)
                .where(
                    self.model.id.in_(ids),  # type: ignore
                    True
                    if bypass_rls
                    else or_(
                        self.current_user.is_superuser,
                        self.rls_insert(self.current_user.id),
                    ),
                )
            )
            result = await self.session.execute(statement)
            nb_records = result.scalar()

            # If not all records pass RLS, rollback and raise
            if nb_records != len(new_records):
                await self.session.rollback()
                raise HTTPException(
                    status_code=403, detail="Some records failed RLS check."
                )

            # Detach the newly inserted instances to prevent memory growth
            for obj in new_records:
                self.session.expunge(obj)

        await self.session.commit()

    async def update(self, id: uuid.UUID, data: BaseModel, bypass_rls: bool = False):
        record = await self.read_by_id(id, bypass_rls=bypass_rls)

        dumped_data = data.model_dump(exclude_unset=True)
        dumped_data["updated_ts"] = datetime.now(timezone.utc)
        record.sqlmodel_update(dumped_data)
        self.session.add(record)

        # Verify RLS
        statement = select(self.model).where(
            self.model.id == id,  # type: ignore
            True
            if bypass_rls
            else or_(
                self.current_user.is_superuser,
                self.rls_update(self.current_user.id),
            ),
        )
        result = await self.session.execute(statement)
        record = result.scalar_one_or_none()
        if not record:
            raise HTTPException(status_code=403)

        await self.session.commit()
        await self.session.refresh(record)
        return await self.read_by_id(id, bypass_rls=True)

    async def delete(self, id: uuid.UUID, bypass_rls: bool = False):
        statement = select(self.model).where(
            self.model.id == id,  # type: ignore
            True
            if bypass_rls
            else or_(
                self.current_user.is_superuser,
                self.rls_delete(self.current_user.id),
            ),
        )
        result = await self.session.execute(statement)
        record = result.scalar_one_or_none()
        if not record:
            raise HTTPException(status_code=403)

        await self.session.delete(record)
        await self.session.commit()

    @staticmethod
    def pool(lst, n):
        for i in range(0, len(lst), n):
            yield lst[i : i + n]
