# Task service

Go owns task records, comments, and the notification outbox in PostgreSQL's `tasks` schema. Every task route validates the bearer session through auth and verifies project membership through the project service. Archived and inaccessible projects return 404. Status values are `todo`, `in_progress`, and `done`.

Required environment: `DATABASE_URL` (PostgreSQL URL), `AUTH_SERVICE_URL`, `PROJECT_SERVICE_URL`, and `RABBITMQ_URL`. `RABBITMQ_QUEUE` defaults to `taskflow.notifications`; `PORT` defaults to `8081`. Service URLs are fixed configuration, never client-supplied destinations.

- `GET /health`: liveness.
- `GET /ready`: PostgreSQL, auth, and project readiness. Notification outages do not block task writes.
- `GET /tasks?projectId=UUID&limit=50&offset=0`: newest tasks first, with ID as a deterministic tie breaker.
- `GET /tasks/{id}`: task details.
- `POST /tasks`: JSON `{projectId,title,description?,assigneeId?}`; default status `todo`.
- `PATCH /tasks/{id}`: any nonempty subset of `{title,description,status,assigneeId}`. Omitted fields retain their values. `assigneeId: null` clears assignment; null is invalid for the other fields.
- `DELETE /tasks/{id}`: returns 204, removes the task and its comments.
- `GET /tasks/{id}/comments?limit=50&offset=0`: comments ordered oldest first, with ID as a deterministic tie breaker.
- `POST /tasks/{id}/comments`: JSON `{body}`; returns `{id,taskId,userId,body,createdAt}`. The author always comes from the validated session.

Both collections return `{items,limit,offset,hasMore}`. The limit defaults to 50 and accepts 1–100; offset defaults to zero and must be nonnegative. Invalid pagination is rejected. The service fetches one extra row to compute `hasMore`; it never silently truncates at the old 500-task boundary.

Tasks include `id`, `projectId`, `title`, `description`, `status`, nullable `assigneeId` and `assigneeName`, and `createdAt`/`updatedAt`. Titles are trimmed and must contain 1–200 characters; descriptions allow at most 10,000 characters. Comments are trimmed and must contain 1–5,000 characters. Request bodies are capped at 64 KiB, unknown properties and trailing JSON are rejected. Assignments use `GET /projects/{projectId}/members/{userId}` with the caller's bearer session; nonmembers are rejected. The validated member name is stored as an assignment snapshot. Removing a member does not rewrite historical task snapshots; setting a new assignee always validates current membership.

Each task mutation and its notification events commit in the same database transaction. Comment creation also updates the task's `updatedAt`. If persisting an event fails, the mutation rolls back. Startup applies embedded, numbered SQL migrations transactionally under a PostgreSQL advisory lock, records checksums in `tasks.schema_migrations`, and refuses changed historical migrations. The baseline adopts the Milestone 1 schema and preserves existing records; subsequent migrations add descriptions, assignments, comments, and the outbox.

A worker starts immediately and resumes all pending outbox records. It atomically claims one event using `FOR UPDATE SKIP LOCKED`, a unique lease token, and a 30-second lease, so replicas can run concurrently and recover after a crash. RabbitMQ publishes are persistent and use publisher confirmations. Failures use exponential delays from one second up to five minutes, with no finite retry limit. Only the current lease token can acknowledge or reschedule a record. Successful publication records `delivered_at`; acknowledged outbox records are retained for inspection. Operators may eventually add retention cleanup once an audit period is chosen.

Delivery is at least once: acknowledgement loss may replay an event, so the notification service deduplicates by its stable event ID. Each recipient has a separate event ID. Events are published to the durable RabbitMQ queue as persistent JSON messages. The wire shape remains `{id,userId,type,message,taskId,projectId,createdAt}`; `userId` identifies the recipient. `task.created`, `task.updated`, `task.deleted`, and `task.commented` notify the actor and current assignee when distinct. Initial assignment or a changed/cleared assignment additionally emits `task.assigned` to the actor and new assignee when distinct. Clearing an assignment notifies the actor.

```sh
go test -race ./...
go vet ./...
go run ./cmd/server
```

The PostgreSQL integration test is opt-in and **resets the `tasks` schema**. Point it only at an empty, disposable database:

```sh
TASK_SERVICE_TEST_DATABASE_URL='postgres://postgres:test@localhost:5432/disposable?sslmode=disable' go test -race ./internal/store -count=1
```

It checks preservation of Milestone 1 rows, repeatable migrations, assignment clearing, comment persistence, rollback of every mutation on outbox insertion failure, concurrent claims, lease recovery, stale acknowledgement rejection, and retry scheduling. HTTP tests cover authentication and project isolation across every route, member assignment, pagination, validation, and comment authorship. Worker tests verify stable IDs across retries and bounded calls/backoff.

The Docker build runs unit tests and creates a static executable. The final distroless image contains that executable, certificate trust, and a non-root user (65532); it has no shell or compiler. The executable's `healthcheck` subcommand probes `/ready`. Requests have bounded timeouts and the server drains on SIGTERM.
