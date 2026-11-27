# Application sources

[Index](../README.md) · [Diagrams](README.md)

| View | Source | What it shows |
| --- | --- | --- |
| Compose | `docker-compose.yml`, service Dockerfiles | Eight services, networks, ports, volumes, and health checks |
| Browser API | `frontend/src/lib/server-api.ts`, `docs/api-contract.md` | Same-origin proxy and private backend URLs |
| Request flow | `docs/architecture.md` | Sign-in, project access, tasks, and notification delivery |
| Outbox | `task-service/internal/store/postgres.go`, `task-service/internal/outbox/worker.go`, `task-service/internal/broker/rabbitmq.go` | Transactional outbox, leases, and publisher confirmations |
| Ingestion | `notification-service/app/broker.py`, `notification-service/app/store.py` | Queue acknowledgement and atomic Redis ingest |
| Diagrams | `docs/architecture/01-docker-architecture.svg`, `docs/architecture/04-notification-delivery.svg` | Container layout and notification delivery |

Container and data-flow overviews also live at `docs/taskflow-container-architecture.svg` and `docs/taskflow-data-flow.svg`.
