# Project service

Java 21 / Spring Boot 4.1.1 owns project records in the PostgreSQL `projects` schema.
Flyway creates the schema and seeds the demo project once. Authentication remains in
the auth service: every project request validates its bearer session through
`GET /auth/me`, then filters storage by that returned identity.

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
- `GET /projects`: projects belonging to the authenticated user.
- `POST /projects`: creates a project from `{ "name": "…", "description": "…" }`.
- `GET /projects/{id}`: one owned project; 404 also covers projects owned by others.

Project routes require `Authorization: Bearer <session>`. Authentication timeouts
and dependency errors return 503; invalid sessions return 401. Public error
responses never include database statements or downstream error bodies.

`project` contains the HTTP controller, validated input, model, and JDBC repository;
`auth` contains the bounded HTTP client; `health` contains health probes; `api`
contains consistent error responses. Services exchange IDs without cross-schema
foreign keys.

## Verification and image

`mvn verify` runs tests covering token forwarding, malformed auth responses,
authentication failure classification, ownership delegation, and input bounds.
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
