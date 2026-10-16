# Docker plan: local baseline

[Diagram](../../architecture/01-docker-architecture.png) · [Stages 1–3](../implementation-plan.md)

## Existing contract

| Component | Container port | Host access | Persistent data |
|---|---|---|---|
| Frontend | 3000 | `127.0.0.1:${FRONTEND_PORT:-3000}` | None |
| Auth | 3001 | Private | PostgreSQL `auth`; Redis sessions |
| Projects | 8080 | Private | PostgreSQL `projects` |
| Tasks | 8081 | Private | PostgreSQL `tasks` + outbox |
| Notifications | 8000 | Private | Redis feeds/dedup; consumes RabbitMQ |
| PostgreSQL | 5432 | Loopback 5433, for development | `postgres-data` |
| Redis | 6379 | Private | `redis-data`, AOF |
| RabbitMQ | 5672; management 15672 | Management UI loopback 15672 only | `rabbitmq-data` |

Frontend ports are configurable; the PostgreSQL host binding is fixed in the current Compose file. Check conflicts before starting another copy. Five app Dockerfiles build/test the application and retain only their runtime closure. The data images are digest-pinned in Compose.

## Start and verify

Run from the application checkout, not this documentation folder:

```sh
cd /Users/bernardboateng/Desktop/Projects/DevOps/taskflow
./scripts/setup.sh
docker compose up --build --wait
docker compose ps
python3 scripts/smoke.py
python3 scripts/milestone2_smoke.py
docker compose exec -T auth-service node --input-type=module < scripts/check-isolation.mjs
python3 scripts/verify_container_policy.py
```

For a custom frontend port, set `FRONTEND_PORT` in ignored local configuration and pass the same address as `TASKFLOW_URL` to the smoke scripts. Preserve other Docker projects. Record startup, tests and image versions in a dated verification note; these commands were documented, not executed by this task.

## Configuration and secret handling

The setup script creates an ignored `.env` and preserves an existing file. Required credentials include the PostgreSQL password, RabbitMQ password and JWT signing secret. Use the script and service documentation as the source of exact environment names. Keep connection-URL passwords URL-safe. The demo login is a development bootstrap, not a production identity-management process.

Redis is currently private and has no configured authentication/TLS. Do not describe it as secured by an invented password. Adding ACL/auth/TLS requires coordinated server and client configuration. For cloud deployment use a managed secret source, secure cookies and the exact HTTPS application origin.

## Persistence and failure checks

Create a clearly named project/task, note its IDs, restart the relevant containers, then verify those records through the frontend. Confirm outbox retries and notification arrival after a temporary broker outage in an isolated test environment. Test session revocation after logout and readiness during dependency loss.

`docker compose down` preserves named volumes; it stops the local stack. `docker compose down --volumes` deletes data and is not part of routine restart verification. Changing initialization credentials in configuration does not rotate credentials inside an already initialized database or broker.

## Completion evidence

Record source revision, tested URL, image IDs/digests, meaningful smoke/isolation results, container policy results and persistence/restart observations. Rebuild or rerun broader checks only after relevant changes or failures. Use the existing image scanning and full-stack verification scripts when validating an image release.
