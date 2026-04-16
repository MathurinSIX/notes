# Production stack: `compose_prod` = docker-compose.prod.yml (external Postgres + S3; no DB containers). Uses `.env` (`just init-env`).
# Development stack: `compose_dev` = docker-compose.yml + docker-compose.traefik.yml (local Postgres, MinIO, Grafana). Compose uses `.env.development` (`just init-env-dev`).
# `just up` = production; `just up-dev` = development with local databases.
# Traefik *container*: `just up` / `just up-dev` = none by default (external Traefik on traefik-public).
# Bundled Traefik: `just up bundled` / `just up-dev bundled` (--profile bundled-traefik).
#
# Dev and prod use different Compose project names (`-p`) so images, volumes, and containers do not
# overlap. Without this, the production frontend image (runner / non-root user) can replace the dev
# image and break `npm install` into the dev `node_modules` volume (EACCES).

root := justfile_directory()
compose_dev := "-f " + root + "/docker-compose.yml -f " + root + "/docker-compose.traefik.yml"
compose_prod := "-f " + root + "/docker-compose.prod.yml"
compose_project_dev := "-p tool_template_dev"
compose_project_prod := "-p tool_template_prod"

[group('help')]
default:
    @just --list --unsorted

# Build and start the production stack (external Postgres + S3/MinIO from `.env`).
# Set POSTGRES_* and BUCKET_URL / S3_* there; use `just init-env` for a starter file.
# `just up` / `just up bundled` — proxy: external (default) or bundled Traefik.
[group('production')]
up proxy='external': init-env
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ ! -f "{{root}}/.env" ]]; then
      echo "Missing {{root}}/.env for production (run: just init-env)" >&2
      exit 1
    fi
    eval "$( "{{root}}/scripts/compose-env.sh" )"
    docker network inspect traefik-public >/dev/null 2>&1 || docker network create traefik-public
    case "{{proxy}}" in
      external) extra=( ) ;;
      bundled) extra=( --profile bundled-traefik ) ;;
      *)
        printf 'just up: unknown proxy=%s (use external or bundled)\n' "{{proxy}}" >&2
        exit 1
        ;;
    esac
    exec docker compose {{compose_project_prod}} --env-file "{{root}}/.env" {{compose_prod}} \
      ${extra[@]+"${extra[@]}"} up -d --build

[group('production')]
down proxy='external':
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ ! -f "{{root}}/.env" ]]; then
      echo "Missing {{root}}/.env" >&2
      exit 1
    fi
    eval "$( "{{root}}/scripts/compose-env.sh" )"
    case "{{proxy}}" in
      external) extra=( ) ;;
      bundled) extra=( --profile bundled-traefik ) ;;
      *)
        printf 'just down: unknown proxy=%s (use external or bundled)\n' "{{proxy}}" >&2
        exit 1
        ;;
    esac
    exec docker compose {{compose_project_prod}} --env-file "{{root}}/.env" {{compose_prod}} \
      ${extra[@]+"${extra[@]}"} down

# Production stack logs (optional service names, e.g. `just logs backend`).
[group('production')]
logs *services:
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ ! -f "{{root}}/.env" ]]; then
      echo "Missing {{root}}/.env" >&2
      exit 1
    fi
    eval "$( "{{root}}/scripts/compose-env.sh" )"
    exec docker compose {{compose_project_prod}} --env-file "{{root}}/.env" {{compose_prod}} logs -f {{ services }}

# Same as `logs` but includes the bundled Traefik `proxy` service.
[group('production')]
logs-bundled *services:
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ ! -f "{{root}}/.env" ]]; then
      echo "Missing {{root}}/.env" >&2
      exit 1
    fi
    eval "$( "{{root}}/scripts/compose-env.sh" )"
    exec docker compose {{compose_project_prod}} --env-file "{{root}}/.env" {{compose_prod}} \
      --profile bundled-traefik logs -f {{ services }}

[group('production')]
ps:
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ ! -f "{{root}}/.env" ]]; then
      echo "Missing {{root}}/.env" >&2
      exit 1
    fi
    eval "$( "{{root}}/scripts/compose-env.sh" )"
    exec docker compose {{compose_project_prod}} --env-file "{{root}}/.env" {{compose_prod}} ps

# Pull production service images (registry bases; built services may no-op).
[group('production')]
pull:
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ ! -f "{{root}}/.env" ]]; then
      echo "Missing {{root}}/.env" >&2
      exit 1
    fi
    eval "$( "{{root}}/scripts/compose-env.sh" )"
    exec docker compose {{compose_project_prod}} --env-file "{{root}}/.env" {{compose_prod}} pull

# Rebuild production images and recreate containers (no registry pull). Same proxy modes as `just up`.
[group('production')]
refresh proxy='external': init-env
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ ! -f "{{root}}/.env" ]]; then
      echo "Missing {{root}}/.env for production (run: just init-env)" >&2
      exit 1
    fi
    eval "$( "{{root}}/scripts/compose-env.sh" )"
    case "{{proxy}}" in
      external) extra=( ) ;;
      bundled) extra=( --profile bundled-traefik ) ;;
      *)
        printf 'just refresh: unknown proxy=%s (use external or bundled)\n' "{{proxy}}" >&2
        exit 1
        ;;
    esac
    exec docker compose {{compose_project_prod}} --env-file "{{root}}/.env" {{compose_prod}} \
      ${extra[@]+"${extra[@]}"} up -d --build --force-recreate

# Restart production services (omit names to restart all), e.g. `just restart backend frontend`.
# With bundled Traefik, include `proxy` in the list or run compose with `--profile bundled-traefik` yourself.
[group('production')]
restart *services:
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ ! -f "{{root}}/.env" ]]; then
      echo "Missing {{root}}/.env" >&2
      exit 1
    fi
    eval "$( "{{root}}/scripts/compose-env.sh" )"
    exec docker compose {{compose_project_prod}} --env-file "{{root}}/.env" {{compose_prod}} restart {{ services }}

# Start development stack. `just up-dev` / `just up-dev external`: no compose Traefik container. `just up-dev bundled`: bundled Traefik when you have no external proxy.
[group('development')]
up-dev proxy='external': init-env-dev
    #!/usr/bin/env bash
    set -euo pipefail
    eval "$( "{{root}}/scripts/compose-env.sh" )"
    docker network inspect traefik-public >/dev/null 2>&1 || docker network create traefik-public
    case "{{proxy}}" in
      external) extra=( ) ;;
      bundled) extra=( --profile bundled-traefik ) ;;
      *)
        printf 'just up-dev: unknown proxy=%s (use external or bundled)\n' "{{proxy}}" >&2
        exit 1
        ;;
    esac
    exec docker compose {{compose_project_dev}} --env-file "{{root}}/.env.development" {{compose_dev}} ${extra[@]+"${extra[@]}"} up -d

# Stop and remove development containers (keeps named volumes).
[group('development')]
down-dev:
    #!/usr/bin/env bash
    set -euo pipefail
    eval "$( "{{root}}/scripts/compose-env.sh" )"
    exec docker compose {{compose_project_dev}} --env-file "{{root}}/.env.development" {{compose_dev}} down

# Follow development service logs; pass service names to limit (e.g. `just logs-dev db`).
[group('development')]
logs-dev *services:
    #!/usr/bin/env bash
    set -euo pipefail
    eval "$( "{{root}}/scripts/compose-env.sh" )"
    exec docker compose {{compose_project_dev}} --env-file "{{root}}/.env.development" {{compose_dev}} logs -f {{ services }}

# Development container status.
[group('development')]
ps-dev:
    #!/usr/bin/env bash
    set -euo pipefail
    eval "$( "{{root}}/scripts/compose-env.sh" )"
    exec docker compose {{compose_project_dev}} --env-file "{{root}}/.env.development" {{compose_dev}} ps

# Refresh development images.
[group('development')]
pull-dev:
    #!/usr/bin/env bash
    set -euo pipefail
    eval "$( "{{root}}/scripts/compose-env.sh" )"
    exec docker compose {{compose_project_dev}} --env-file "{{root}}/.env.development" {{compose_dev}} pull

# Rebuild development images and recreate running containers (no registry pull).
[group('development')]
refresh-dev: init-env-dev
    #!/usr/bin/env bash
    set -euo pipefail
    eval "$( "{{root}}/scripts/compose-env.sh" )"
    exec docker compose {{compose_project_dev}} --env-file "{{root}}/.env.development" {{compose_dev}} up -d --build --force-recreate

# Restart one or more development services (e.g. `just restart-dev backend frontend`).
[group('development')]
restart-dev *services:
    #!/usr/bin/env bash
    set -euo pipefail
    eval "$( "{{root}}/scripts/compose-env.sh" )"
    exec docker compose {{compose_project_dev}} --env-file "{{root}}/.env.development" {{compose_dev}} restart {{ services }}

# Regenerate `frontend/src/client` from the OpenAPI spec (Docker; needs Compose DB for backend import).
[group('backend')]
generate_client:
    chmod +x "{{root}}/scripts/generate-client-docker.sh" && "{{root}}/scripts/generate-client-docker.sh"

# Create a new Alembic revision from the current models (Docker; writes under backend/app/alembic/versions).
[group('backend')]
[positional-arguments]
create_revision message: init-env-dev
    #!/usr/bin/env bash
    set -euo pipefail
    cd "{{root}}"
    msg=$(printf %q "$1")
    docker compose {{compose_project_dev}} --env-file "{{root}}/.env.development" -f "{{root}}/docker-compose.yml" run --rm \
        -v "{{root}}/backend/app:/app/app" \
        backend bash -lc "cd /app && alembic revision --autogenerate -m $msg"

# Apply all pending Alembic migrations (Docker).
[group('backend')]
migrate: init-env-dev
    docker compose {{compose_project_dev}} --env-file "{{root}}/.env.development" -f "{{root}}/docker-compose.yml" run --rm \
        -v "{{root}}/backend/app:/app/app" \
        backend bash -lc "cd /app && alembic upgrade head"

# Add a Python dependency via uv in Docker (updates backend/pyproject.toml + uv.lock; full repo mount for path deps).
[group('packages')]
[positional-arguments]
add_pkg_backend package:
    #!/usr/bin/env bash
    exec "{{root}}/scripts/add-pkg-backend-docker.sh" "$1"

# Add a frontend dependency via npm in Docker (updates frontend/package.json + package-lock.json).
[group('packages')]
[positional-arguments]
add_pkg_frontend package:
    #!/usr/bin/env bash
    exec "{{root}}/scripts/add-pkg-frontend-docker.sh" "$1"

# Copy `.env.example` to `.env` if missing (does not overwrite).
[group('setup')]
init-env:
    test -f .env || cp .env.example .env

# Copy `.env.development.example` to `.env.development` if missing (does not overwrite).
[group('setup')]
init-env-dev:
    test -f .env.development || cp .env.development.example .env.development
