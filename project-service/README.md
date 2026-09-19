# Project service

Java 21 / Spring Boot 4.1.1 owns project records in the PostgreSQL `projects` schema.
Flyway creates the schema and seeds the demo project once. Version 2 adds project
memberships and soft archives without replacing existing data. Authentication
remains in the auth service: every project request validates its bearer token
through `GET /auth/me`, then filters storage by that returned identity.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `jdbc:postgresql://localhost:5432/taskflow` | PostgreSQL JDBC URL |
| `DB_USER` | `taskflow` | Database username |
| `DB_PASSWORD` | Required | Database password |
| `AUTH_SERVICE_URL` | `http://localhost:3001` | Auth service base URL |
| `PORT` | `8080` | HTTP listen port |

Start the full stack from the repository root with Docker Compose. To run this
service separately with Java 21 and Maven installed, supply the variables above
and run `mvn spring-boot:run`.

## API

- `GET /health`: process liveness; does not probe dependencies.
- `GET /ready`: checks PostgreSQL and auth readiness; returns 503 when unavailable.
- `GET /projects?limit=50&offset=0`: owned and joined active projects, returning
  `{ "items": [...], "limit": 50, "offset": 0, "hasMore": false }`. Limit is
  1–100; offset must be non-negative. Order is creation time descending, then ID.
- `POST /projects`: creates a project from `{ "name": "…", "description": "…" }`.
- `GET /projects/{id}`: one accessible project. Project responses include `id`,
  `name`, `description`, `ownerId`, `createdAt`, and the caller's `role` (`owner`
  or `member`). Inaccessible and archived projects return 404.
- `PATCH /projects/{id}`: owner updates `name`, `description`, or both. Omitted or
  null fields keep their existing values; use an empty description to clear it.
- `DELETE /projects/{id}`: owner archives a project and receives 204. Records and
  cross-service task references remain stored; subsequent project reads return 404.
- `GET /projects/{id}/members`: returns `{ "items": [...] }`, including the owner
  first. Each member contains `userId`, `name`, `email`, and `role`.
- `POST /projects/{id}/members`: owner adds an existing user by `{ "email": "…" }`.
  Returns 201 and the member. Re-adding a member refreshes their stored profile
  without duplicating membership. Adding the owner returns 400.
- `DELETE /projects/{id}/members/{userId}`: owner removes a member and receives
  204, or 404 for an absent membership. Removing the owner returns 400.
- `GET /projects/{id}/members/{userId}`: returns an owner or current member for
  task assignment validation; the caller must have project access.

Project routes require `Authorization: Bearer <token>` (up to 4096 token characters).
Members can read projects and teams; management requests from members return 403.
Email lookup uses `GET /auth/users?email=...`, and owner profile lookup uses
`GET /auth/users/{id}`, both with the original bearer token. Member profiles are
stored when added; ownership comes from the project record and cannot be removed
through the membership API. Authentication timeouts and dependency errors return
503; invalid sessions or JWTs return 401. Public error
responses never include database statements or downstream error bodies.

`project` contains the HTTP controller, validated input, model, and JDBC repository;
`auth` contains the bounded HTTP client; `health` contains health probes; `api`
contains consistent error responses. Services exchange IDs without cross-schema
foreign keys.

## Verification and image

`mvn verify` runs tests covering token forwarding, encoded email lookups, malformed
auth responses, authentication failure classification, membership access,
owner-only management, pagination, and HTTP input validation.
The Docker build runs the same tests before packaging:

```sh
docker build -t taskflow-project-service:local .
```

The final image contains a JRE, the executable application JAR, and curl for its
readiness probe. It runs as UID/GID 10001, accepts configuration through the
environment, and gracefully stops on SIGTERM. Maven dependencies are pinned by
the Spring Boot 4.1.1 dependency BOM; update that version and base image tags
together with a rebuild and stack smoke test as maintenance releases become
available. No application credentials are baked into the image.
