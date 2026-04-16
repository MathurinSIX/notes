import logging

from sqlmodel import Session, select

from app.api.routes.user.models import User
from app.core import security
from app.core.config import settings
from app.core.db import engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def init() -> None:
    email = (settings.FIRST_SUPERUSER_EMAIL or "").strip()
    password = (settings.FIRST_SUPERUSER_PASSWORD or "").strip()
    if not password:
        logger.info("Skipping seed user (FIRST_SUPERUSER_PASSWORD not set)")
        return
    if not email:
        logger.info("Skipping seed user (FIRST_SUPERUSER_EMAIL empty)")
        return

    with Session(engine) as session:
        existing = session.exec(select(User).where(User.email == email)).first()
        if existing:
            logger.info("Seed user already exists: %s", email)
            return
        user = User(
            email=email,
            hashed_password=security.get_password_hash(password),
            is_superuser=True,
            is_active=True,
        )
        session.add(user)
        session.commit()
        logger.info("Created seed superuser: %s", email)


def main() -> None:
    logger.info("Creating initial data")
    init()
    logger.info("Initial data created")


if __name__ == "__main__":
    main()
