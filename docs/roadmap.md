# Application scope

TaskFlow is a local polyglot task workspace:

- Registration, password hashes, and revocable sessions
- Shared projects, membership, editing, and archival
- Task CRUD, assignments, comments, and pagination
- Notification events committed with each task change, published through RabbitMQ, and stored in Redis
- Health and readiness checks on every application service
- Local PostgreSQL, Redis, and RabbitMQ through Docker Compose

Service source stays inside its own directory. Each service owns its schema or keys and does not query another service's tables.
