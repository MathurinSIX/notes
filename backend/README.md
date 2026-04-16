# FastAPI Project - Backend

## Requirements

* [Docker](https://www.docker.com/)
* [Docker Compose](https://docs.docker.com/compose/)
* [uv](https://docs.astral.sh/uv/) for Python package and environment management

## Architecture

### How the application is built

1. **Entry point** — `app/main.py` creates the FastAPI app, configures middleware (CORS, metrics), and mounts the API router via `app.include_router(api_router)`.

2. **API router** — `app/api/main.py` defines a single `APIRouter()` and includes domain routers (e.g. login). Each domain router is added with `api_router.include_router(...)`.

3. **Domain routers** — Each domain under `app/api/routes/<domain>/` defines its own `APIRouter(prefix="/<resource>", tags=["..."])` and route handlers. URLs are e.g. `GET /example/hello` (no `/api` prefix unless you add it in `main.py`).

4. **Request flow** — FastAPI matches the path to a route; dependencies (e.g. `SessionDep`, `CurrentUser`) are resolved; injecting `CurrentUser` triggers authentication; the route handler calls the service; the service uses the repository and/or other dependencies. Repositories that extend `BaseRepository` apply RLS (row-level security).

### File layout (domain structure)

The API is organized by **domain** (resource). Each domain under `app/api/routes/` typically has:

| File            | Role |
|-----------------|------|
| `models.py`     | SQLModel table definitions — database schema. |
| `schemas.py`    | Pydantic/SQLModel request/response schemas (Create, Update, Out, list wrappers). |
| `repository.py` | Data access. Subclasses `BaseRepository` from `_shared/repository.py`, defines RLS and filters. Exposes `*Dep` for dependency injection. |
| `service.py`    | Application logic. One class per domain; methods map to route actions. Uses repository (and optionally `CurrentUser`, other services). Exposes `*ServiceDep`. |
| `routes.py`     | HTTP layer. Defines the `APIRouter` and endpoints; each endpoint calls the service. No business logic or SQL here. |

**Shared code**

- `app/api/routes/_shared/` — `BaseRepository`, `BaseService`, shared utilities.
- `app/api/deps.py` — Global dependencies: `SessionDep`, `TokenDep`, `CurrentUser`, `get_current_active_superuser`.
- `app/core/` — Config, DB engine, security (JWT, password hashing), cache, background tasks.
### Permissions

- **Authentication** — Routes that depend on `CurrentUser` require a valid Bearer token (OAuth2). `get_current_user` in `deps.py` decodes the JWT, loads the user, checks `is_active` and token validity. Use `get_current_active_superuser` for admin-only routes.
- **Row-level security (RLS)** — Repositories extending `BaseRepository` use `rls_select`, `rls_insert`, `rls_update`, `rls_delete` so only allowed rows are visible or writable. Superuser bypasses RLS.
- **Custom checks** — For actions not covered by a single resource’s RLS (e.g. “access workspace X”), the service loads the resource and checks e.g. membership or `is_public`, then raises 403 if not allowed.

### Adding a new endpoint

- **New domain** — Add a folder under `app/api/routes/<domain>/` with `models.py`, `schemas.py`, `repository.py`, `service.py`, `routes.py`. Register the router in `app/api/main.py`. Add the model to `app/alembic/env.py` and run `alembic revision --autogenerate` and `alembic upgrade head`.
- **Existing domain** — Add schemas, repository methods, service method, and route in that domain’s files; inject `*ServiceDep` and optionally `CurrentUser`.

### When to use an endpoint

| Use this | When |
|----------|------|
| **Endpoint** (normal API route) | The work is **fast** (under a few seconds), **synchronous**, and the client should wait for the result. Examples: CRUD, auth, validation, simple queries. Implement as a route under `app/api/routes/<domain>/` that calls a service and returns the response. |

### Using the bucket to upload files from an endpoint

The stack uses **MinIO** in Docker Compose for S3-compatible storage locally; in production you can use real GCS (native JSON API) or any S3-compatible endpoint.

**1. Environment**

- `BUCKET_URL` — S3 API endpoint (e.g. `http://storage:9000` from other Compose services, or `http://localhost:9000` from the host).
- `BUCKET_NAME` — Bucket name (created on startup by the `storage-init` service when using the template Compose file).
- `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` — Credentials for the S3 client (match `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` for local MinIO).
- (Optional) `S3_REGION_NAME` — Default `us-east-1` (required by boto3; MinIO ignores it for most calls).
- (Optional) `BUCKET_PREFIX` — Prefix for object keys (e.g. `prod/` or `uploads/`); prepend when building keys.
- (Optional) `PROVIDER_CREDENTIALS` — Path to a GCS service account JSON file. When set, `get_bucket()` returns a **google-cloud-storage** bucket instead of boto3 (no `BUCKET_URL` endpoint override in that path unless you extend it).

**2. Dependencies**

- `boto3` for MinIO / S3 (default when `PROVIDER_CREDENTIALS` is unset).
- `google-cloud-storage` when using native GCS with `PROVIDER_CREDENTIALS`.

**3. Config and bucket dependency**

`app/core/config.py` defines `BUCKET_URL`, `BUCKET_NAME`, `BUCKET_PREFIX`, and S3-related fields.

`app/api/deps.py` exposes `get_bucket()` / `BucketDep`:

- If `PROVIDER_CREDENTIALS` is set: `storage.Client.from_service_account_json(...).bucket(...)`.
- Else: boto3 `resource("s3", endpoint_url=settings.BUCKET_URL, ...).Bucket(...)`.

**4. Upload endpoint**

Create a route that accepts a file and uploads it to the bucket:

- Use `UploadFile` (or `File(...)`) in the route.
- Optionally require `CurrentUser` so only authenticated users can upload.
- Generate a unique object key (e.g. `f"uploads/{user_id}/{uuid.uuid4()}_{filename}"`).
- Read the file (e.g. `content = await file.read()`).
- **MinIO / boto3 (default):** `bucket.put_object(Key=full_path, Body=content, ContentType=file.content_type or "application/octet-stream")` (or `bucket.Object(full_path).put(...)`).
- **Native GCS:** `bucket.blob(full_path).upload_from_string(content, content_type=...)`.
- Return the object path or a URL (e.g. `201 Created`).

Example shape for **local MinIO / S3** (pseudo-code):

```python
# In app/api/routes/files/routes.py (or under an existing domain)
import uuid
from fastapi import APIRouter, UploadFile

from app.api.deps import BucketDep, CurrentUser
from app.core.config import settings

router = APIRouter(prefix="/files", tags=["Files"])

@router.post("/upload")
async def upload_file(
    current_user: CurrentUser,
    bucket: BucketDep,
    file: UploadFile,
):
    object_name = f"uploads/{current_user.id}/{uuid.uuid4()}_{file.filename or 'file'}"
    full_path = f"{settings.BUCKET_PREFIX.rstrip('/')}/{object_name.lstrip('/')}".lstrip("/") if settings.BUCKET_PREFIX else object_name
    content = await file.read()
    bucket.put_object(
        Key=full_path,
        Body=content,
        ContentType=file.content_type or "application/octet-stream",
    )
    return {"path": object_name, "message": "Uploaded"}
```

**5. Download / public URL**

- **boto3:** presign with the client (`generate_presigned_url`) or stream via `Object(key).get()["Body"].read()` in a dedicated download route.
- **GCS:** `blob.generate_signed_url(...)` or `blob.download_as_bytes()`.
- For browser or external tools against MinIO, the API is on `BUCKET_URL` (e.g. console on port `9001` in the default Compose file).

**Summary**

- For Docker: set `BUCKET_URL`, `BUCKET_NAME`, and MinIO/S3 credentials in `.env.development` (see `.env.development.example`). Compose overrides `BUCKET_URL` to `http://storage:9000` for the backend so the container always reaches the MinIO service.
- For native GCS: set `PROVIDER_CREDENTIALS` and use the google-cloud-storage APIs on the returned bucket.

---

## Folder structure

Each domain folder under `app/api/routes/` contains:

- `models.py` — SQLModel (SQLAlchemy) data models and database schema.
- `schemas.py` — Pydantic/SQLModel schemas for API request/response.
- `repository.py` — Data access (repository pattern); RLS and queries.
- `service.py` — Business logic; one service class, methods per route action.
- `routes.py` — FastAPI routes; call service methods only, no business logic or SQL.

Shared utilities live in `app/api/routes/_shared/` or root-level `utils.py`.

---

## Docker Compose

A single `docker-compose.yml` at the project root is used for local development and deployment. It exposes ports (e.g. backend on 8000, db on 5432), includes a local Traefik proxy, and mounts the backend code for live reload.

Run the stack with watch so the backend reloads on file changes:

```console
$ docker compose --env-file .env.development -f docker-compose.yml -f docker-compose.traefik.yml up
```

To get inside the backend container (after the stack is up):

```console
$ docker compose --env-file .env.development -f docker-compose.yml -f docker-compose.traefik.yml exec backend bash
```

You are then in `/app`; the app code is under `/app/app`. You can run a reload server manually with:

```console
$ cd app && uvicorn main:app --host 0.0.0.0 --port 8000 --reload --loop asyncio
```

See the project root [development](../development.md) guide if referenced there.

---

## General workflow (local dev without Docker for backend)

Dependencies are managed with [uv](https://docs.astral.sh/uv/). From `./backend/`:

```console
$ uv sync
$ source .venv/bin/activate
```

Use the interpreter at `backend/.venv/bin/python` in your editor.

- Add or change SQLModel models under the relevant domain in `app/api/routes/<domain>/models.py` (and register in `app/alembic/env.py` if it’s a new table).
- Add or change API endpoints in `app/api/routes/<domain>/routes.py` and the corresponding service and repository.

---

## VS Code

Configurations are in place to run the backend through the VS Code debugger (breakpoints, variables) and to run tests via the Python tests tab.

---

## Migrations

With the app directory mounted (e.g. in Docker), run Alembic from the backend container or from `backend/` with the venv activated.

- **Create a revision** after changing models:

  ```console
  $ cd backend && uv run alembic revision --autogenerate -m "Add column X to Y"
  ```

- **Apply migrations**:

  ```console
  $ cd backend && uv run alembic upgrade head
  ```

Commit the generated files under `app/alembic/versions/`. Models are imported in `app/alembic/env.py` (per-domain model imports); ensure any new table’s model is imported there.

To avoid migrations and create tables from code instead, uncomment `SQLModel.metadata.create_all(engine)` in `app/core/db.py` and comment the `alembic upgrade head` line in `scripts/prestart.sh`.

---

## Quick reference

- **Auth** — `CurrentUser` = require login; `get_current_active_superuser` = require superuser.
- **Data access** — One repository per domain, subclassing `BaseRepository`; RLS via `rls_select` / `rls_insert` / `rls_update` / `rls_delete`.
- **New domain** — Add folder under `app/api/routes/<domain>/`, implement models, schemas, repository, service, routes; register router in `api/main.py`; add model to Alembic `env.py` and run migrations.
