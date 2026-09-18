# Task service

Go owns task records in the PostgreSQL `tasks` schema. It authenticates sessions through auth and verifies every requested project's ownership through the project service before listing, creating, or changing tasks. Status values are `todo`, `in_progress`, and `done`.

Required environment: `DATABASE_URL` (PostgreSQL URL), `AUTH_SERVICE_URL`, `PROJECT_SERVICE_URL`, `NOTIFICATION_SERVICE_URL`, `INTERNAL_API_KEY`. `PORT` defaults to `8081`. Service URLs are fixed configuration, never client-supplied destinations.

- `GET /health`: liveness.
- `GET /ready`: PostgreSQL, auth, and project readiness. Notifications are an optional write-side dependency.
- `GET /tasks?projectId=UUID`: newest 500 tasks for an owned project; pagination is deferred.
- `POST /tasks`: JSON `{projectId,title}`; default status `todo`.
- `PATCH /tasks/{id}`: JSON `{status}`.

Task APIs require a bearer session. A successful database write triggers best-effort HTTP notification delivery. The task remains committed if delivery fails, with an event/task identifier in the warning log. Reliable delivery requires a future transactional outbox. Initial schema creation is idempotent startup SQL; introduce versioned migrations before schema evolution.

```sh
go test -race ./...
go vet ./...
go run ./cmd/server
```

The Docker build runs unit tests and creates a static executable. The final distroless image contains that executable, certificate trust, and a non-root user (65532); it has no shell or compiler. The executable's `healthcheck` subcommand probes `/ready`. Requests have bounded timeouts and the server drains on SIGTERM.
