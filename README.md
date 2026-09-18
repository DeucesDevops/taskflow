# TaskFlow

A local task workspace built with five services in four backend languages. **Milestone 1 only:** sign in, create projects and tasks, move work between statuses, and view task notifications. One Docker Compose command runs the application, PostgreSQL, and Redis.

## Run locally

Prerequisites: Docker Desktop (or Docker Engine with Compose v2.20+), a running Docker daemon, and OpenSSL for generating local configuration. Allocate roughly 4 GB of memory to Docker. You do not need Java, Go, Python, or Node installed to run the application.

```sh
./scripts/setup.sh
docker compose up --build --wait
```

Open **http://localhost:3000**. Sign in with:

- Email: `alex@taskflow.local`
- Password: `taskflow-local-demo`

The default demo project is **Platform launch**. Create a task, select its status, and open Activity to see its notification. You can also create a project, search tasks in the current project, and track completion above the board. The responsive sign-in and workspace include light and dark modes, use the device theme on first visit, remember an explicit choice, and provide keyboard focus states and reduced-motion support. First builds download several language runtimes and take longer than subsequent starts.

`setup.sh` creates a git-ignored `.env` with random database and internal API credentials and preserves existing configuration. Alternatively, copy `.env.example` to `.env` and supply your own values. Keep `POSTGRES_PASSWORD` URL-safe because it is used in connection URLs. Set `FRONTEND_PORT` if port 3000 is occupied. If you customize the demo email/password, enter your configured values in the sign-in form. The form's sample credentials stay at their defaults.

Only the frontend is published, bound to `127.0.0.1`. Backend services, PostgreSQL, and Redis are accessible on the Compose network. This setup is for local development, not an Internet deployment.

## Check and stop

```sh
docker compose ps
python3 scripts/smoke.py
docker compose exec -T auth-service node --input-type=module < scripts/check-isolation.mjs
docker compose logs --tail=100 -f
# Stop services while keeping data:
docker compose down
# Start the existing images again:
docker compose up --wait
```

The smoke check needs Python 3 on the host. It checks liveness/readiness, login/logout, httpOnly cookies, unauthenticated access, cross-origin write rejection, project creation, task creation/status changes, and notification delivery. It deliberately leaves a clearly named smoke project/task so persistence can be inspected. For a custom port, run `TASKFLOW_URL=http://localhost:YOUR_PORT python3 scripts/smoke.py`. Pass `DEMO_EMAIL` and `DEMO_PASSWORD` as environment variables if changed.

PostgreSQL and Redis use named volumes. `docker compose down` preserves them. **`docker compose down --volumes` permanently deletes this project's local data**, including sessions. If you change the database password after the first start, also update the existing database role password or intentionally reset the volumes; initialization settings do not update an existing database.

## Repository

```text
taskflow/
├── frontend/                 Next.js + TypeScript UI and same-origin API proxy
├── auth-service/             Node.js + TypeScript, password check and sessions
├── project-service/          Java + Spring Boot, owned projects
├── task-service/             Go, tasks and project-ownership checks
├── notification-service/     Python + FastAPI, notification ingestion and feed
├── scripts/                  Local setup and end-to-end smoke check
├── docs/                     API contract, architecture, scope and verification
├── docker-compose.yml        All seven local services and persistent volumes
└── .env.example              Documented local configuration
```

Each service has its own dependencies, lock/version declarations, Dockerfile, runtime configuration, and health checks. Backends have focused tests; the frontend is typechecked, production-built, and exercised by the stack smoke check. There is no shared backend code package or hidden dependency on host language runtimes.

## Service boundaries

| Service | Internal port | Responsibilities | Data |
| --- | --- | --- | --- |
| Frontend | 3000 | Workspace, forms, same-origin API routes | httpOnly session cookie |
| Auth | 3001 | Demo sign-in, session lookup/revocation | PostgreSQL `auth` schema; Redis sessions |
| Projects | 8080 | Create/list/get owned projects | PostgreSQL `projects` schema |
| Tasks | 8081 | Create/list/update task status | PostgreSQL `tasks` schema |
| Notifications | 8000 | Accept internal events, return current user's feed | Redis lists and deduplication keys |
| PostgreSQL | 5432 | Persistent application records | Named volume |
| Redis | 6379 | Expiring sessions and notification feeds | Named volume, append-only persistence |

Every app service exposes `/health` for liveness and `/ready` for dependency readiness. Compose waits for readiness before starting dependents. The browser calls only the frontend. Backend URLs and bearer tokens stay server-side. Auth owns the user identity; projects enforce owner access; tasks check access through the project service. Task changes call the notification service with an internal key. See [architecture](docs/architecture.md) and [API contract](docs/api-contract.md).

## Development and tests

Docker builds compile each app and run its focused tests (the frontend is typechecked and production-built). Rebuild after code changes:

```sh
docker compose up --build --wait
python3 scripts/smoke.py
```

Individual checks with the appropriate runtimes installed:

```sh
(cd auth-service && npm ci && npm run build && npm test)
(cd frontend && npm ci && npm run typecheck && npm run build)
(cd project-service && mvn test)
(cd task-service && go test ./...)
(cd notification-service && python3.13 -m venv .venv && .venv/bin/pip install --require-hashes -r requirements.txt && .venv/bin/python -m unittest discover -s tests -v)
```

Recorded results are in [the verification notes](docs/verification.md). See each service's package/build manifest for runtime versions. Native runs require the service environment variables in [the API contract](docs/api-contract.md) and reachable backing services; Compose is the supported, fully wired local path.

For startup problems, inspect `docker compose ps` and the failing service's logs. Verify Docker is running, `.env` exists, and your selected frontend port is free. A backend outage produces a failed readiness check and a visible error in the UI; health does not pretend the dependency is available.

## Deliberate Milestone 1 limits

This is a working development foundation with production-oriented structure, not a production deployment. There is one seeded demo account, no registration/reset flow, no team membership, and only create/list/status-change operations. Sessions last 24 hours. Notification feeds retain the latest 100 entries and expire after seven days without new events; task-to-notification delivery is best-effort HTTP. A committed task is retained even when notification delivery fails, with the failure logged. Reliable event delivery needs an outbox/queue in a later milestone.

Schemas belong to individual services but use one local database role. The Java service uses Flyway; auth/tasks use idempotent startup SQL for their initial schemas. Future schema changes require versioned migrations. Containers run applications as non-root users, keep secrets outside images, use bounded calls, and shut down gracefully. Production work still includes TLS, managed secrets, per-service database roles, backups, durable event delivery, proper identity/team authorization, and deployment-specific rate limiting.

Dependency lockfiles and explicit runtime versions keep dependency versions consistent; PostgreSQL and Redis images are pinned by digest. Maintain those pins and application dependencies together as security updates become available. No cloud infrastructure or external notification provider is provisioned.

The next stages remain [documented only](docs/roadmap.md): deeper APIs/data modeling, hardening, CI, Terraform/AWS, EKS/Helm, Argo CD, observability/DevSecOps, and Backstage.
