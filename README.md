# TaskFlow

TaskFlow is a local team task workspace. The browser talks only to a Next.js frontend. Four backend services, written in Node.js, Java, Go, and Python, own users, projects, tasks, and notifications. PostgreSQL, Redis, and RabbitMQ keep records, sessions, and task events.

One Docker Compose command runs the application and its local data services.

## Services

| Service | Language | Port | Responsibility |
| --- | --- | --- | --- |
| Frontend | Next.js, TypeScript | 3000 | Workspace UI and same-origin API proxy |
| Auth | Node.js, TypeScript | 3001 | Registration, password check, revocable sessions |
| Projects | Java, Spring Boot | 8080 | Projects, members, and archival |
| Tasks | Go | 8081 | Tasks, comments, assignments, and the notification outbox |
| Notifications | Python, FastAPI | 8000 | Durable event consumption and the activity feed |
| PostgreSQL | — | 5432 | `auth`, `projects`, and `tasks` schemas |
| Redis | — | 6379 | Sessions, feeds, and deduplication keys |
| RabbitMQ | — | 5672 | Durable task-event queue |

The browser calls the frontend only. Backend URLs stay on the server. Auth owns identity. Projects enforce access. Tasks check membership through the project service, commit notification events in the same database transaction, and publish them to RabbitMQ. The notification service consumes that queue into Redis.

See [architecture](docs/ARCHITECTURE.md) and the [API contract](docs/api-contract.md).

## Run locally

Prerequisites: Docker Engine with Compose v2, and OpenSSL if you generate local configuration with the setup script. You do not need Java, Go, Python, or Node on the host to run the stack.

From the repository root:

```sh
./scripts/setup.sh
docker compose up --build --wait
```

`setup.sh` creates a git-ignored `.env` when one does not exist, and leaves an existing file in place. You can instead copy `.env.example` to `.env` and set the names listed below. Passwords that are embedded in connection URLs must be URL-safe.

Open **http://localhost:3000**. Create a local account from the sign-in page (name, email, and a password of at least 12 characters). The auth service can also seed one bootstrap account from `DEMO_EMAIL` and `DEMO_PASSWORD` the first time it starts; set those names in `.env` before that start if you want a known bootstrap user. Existing seed rows are not overwritten.

The frontend listens on `127.0.0.1` and `FRONTEND_PORT` (3000 when unset). PostgreSQL's development port is `127.0.0.1:5433`. The RabbitMQ management UI is `127.0.0.1:15672`. Application ports, Redis, and the AMQP port stay on the Compose network.

```sh
docker compose ps
docker compose logs --tail=100 -f
docker compose down
```

`docker compose down` keeps named volumes. `docker compose down --volumes` deletes this project's local data, including sessions and queued messages. Changing a database or broker password after the first start does not rewrite an existing volume.

## Deployment

The Azure platform is Terraform, Helm, and GitHub Actions. AKS runs the five application containers. PostgreSQL Flexible Server and Azure Cache for Redis are optional managed modules. RabbitMQ runs in the cluster. The default region is `uksouth`. The public domain is a Terraform variable; `example.com` in the example tfvars is not a real zone.

```sh
export TF_VAR_subscription_id="<subscription-guid>"
export TF_VAR_tenant_id="<tenant-guid>"
BOOTSTRAP_CONFIRM=apply ./scripts/bootstrap-state.sh
make plan ENV=dev
APPLY_CONFIRM=apply make apply ENV=dev
make kubeconfig ENV=dev
```

`make validate` checks formatting and runs `terraform validate` on every module and both environment roots. Apply is two-stage so the cluster exists before Helm. GitHub Actions signs in with OIDC federated credentials and does not use a client secret. Production image tags change only after the `production` environment approval, and Argo CD syncs `helm/taskflow`.

Details are in [docs/SETUP.md](docs/SETUP.md), [docs/PIPELINE.md](docs/PIPELINE.md), and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Tests

Service checks, from each directory, with that language toolchain installed:

```sh
(cd auth-service && npm ci && npm test)
(cd frontend && npm ci && npm test && npm run typecheck)
(cd project-service && mvn test)
(cd task-service && go test ./...)
(cd notification-service && python3 -m venv .venv && .venv/bin/pip install --require-hashes -r requirements.txt && .venv/bin/python -m unittest discover -s tests -v)
```

The notification Redis cases run only when `NOTIFICATION_TEST_REDIS_URL` is set. With the Compose stack up, from the repository root:

```sh
docker run --rm --network taskflow_backend \
  -e NOTIFICATION_TEST_REDIS_URL=redis://redis:6379/0 \
  -v "$PWD/notification-service/tests:/tests:ro" \
  taskflow-notification-service python -m unittest discover -s /tests -v
```

Smoke checks need Python 3 on the host and a running stack. They call the frontend, leave a clearly named smoke project, and do not print configuration values:

```sh
python3 scripts/smoke.py
python3 scripts/milestone2_smoke.py
docker compose exec -T auth-service node --input-type=module < scripts/check-isolation.mjs
```

`smoke.py` checks liveness, readiness, sign-in, the httpOnly session cookie, unauthenticated access, cross-origin rejection, projects, tasks, and notifications. `milestone2_smoke.py` covers registration, membership, task edits, comments, and archival. `check-isolation.mjs` checks that one user cannot read or change another user's data. For a custom frontend port, set `TASKFLOW_URL` to that address when running the Python scripts.

Image builds also run each service's focused tests before producing the runtime image.

## Environment variables

Set these in `.env`. Names only:

- `POSTGRES_PASSWORD`
- `RABBITMQ_PASSWORD`
- `JWT_SECRET`
- `DEMO_EMAIL`
- `DEMO_PASSWORD`
- `FRONTEND_PORT`

Compose passes these names into services. Values come from `.env` or from Compose itself; they are not listed here:

- `DATABASE_URL`
- `DB_USER`
- `DB_PASSWORD`
- `REDIS_URL`
- `RABBITMQ_URL`
- `RABBITMQ_QUEUE`
- `AUTH_SERVICE_URL`
- `PROJECT_SERVICE_URL`
- `TASK_SERVICE_URL`
- `NOTIFICATION_SERVICE_URL`
- `PORT`
- `HOSTNAME`
- `SESSION_COOKIE_SECURE`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `RABBITMQ_DEFAULT_USER`
- `RABBITMQ_DEFAULT_PASS`

`JWT_SECRET` must be at least 32 UTF-8 bytes. `TASKFLOW_URL` is read by the host smoke scripts. `NOTIFICATION_TEST_REDIS_URL` is read by the notification Redis tests.

## Repository

```text
taskflow/
├── frontend/              Next.js UI and same-origin API proxy
├── auth-service/          Node.js auth and sessions
├── project-service/       Java projects
├── task-service/          Go tasks and outbox
├── notification-service/  Python notifications
├── scripts/               Local setup, smoke checks, and Azure workflows
├── terraform/             Bootstrap, modules, and dev/production roots
├── helm/                  TaskFlow chart and Argo CD application
├── platform/              Controller values, issuer, secret store, storage class
├── observability/         Dashboards, alerts, and SLOs
├── docs/                  Application docs plus platform setup and ADRs
├── docker-compose.yml     Application and local data services
└── .env.example           Configuration names
```

Each service has its own manifest, lockfile, Dockerfile, and tests.
