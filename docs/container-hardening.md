# Container hardening

Milestone 3 makes the local Compose runtime policy executable and reviewable. It does not claim that the local stack is an Internet-ready production deployment.

## Application runtime contract

All five application images use multi-stage builds. Tests run in build stages, and final images contain only the runtime, production dependencies, and the built application. Every external base image is pinned by a multi-platform SHA-256 digest.

| Service | Runtime process | Runtime contents | Writable path |
| --- | --- | --- | --- |
| Frontend | `node server.js` | Node copied into a distroless base and Next.js standalone output | `/tmp` tmpfs |
| Auth | `node dist/index.js` | Node copied into a distroless base, compiled JavaScript, production dependencies | `/tmp` tmpfs |
| Projects | `java -jar /app/project-service.jar` | Java 21 JRE, application JAR, health-check curl | `/tmp` tmpfs |
| Tasks | `/app/task-service` | Static Go executable and certificate trust | `/tmp` tmpfs |
| Notifications | `uvicorn app.main:app` | Alpine Python, copied virtual environment, application source | `/tmp` tmpfs |

The Node runtime images use a distroless base and do not contain npm. The Alpine Python runtime does not contain pip. Package managers stay in build stages. The task runtime is also distroless and has no shell or compiler.

Compose enforces a numeric non-root user, a read-only root filesystem, a `noexec,nosuid` `/tmp`, `no-new-privileges`, all Linux capabilities dropped, PID limits, memory limits, CPU limits, bounded log files, an init process, health checks, and stop grace periods. Only loopback host ports are allowed. The application services share an internal backend network; the frontend also joins a separate ingress network so `127.0.0.1:3000` remains reachable.

Redis runs directly as its image's numeric `999:999` user, uses a read-only root, and writes only to its named `/data` volume. PostgreSQL keeps its official entrypoint behavior and writable named data volume because database initialization and storage require them. Its runtime is still PID-, memory-, and CPU-limited. Production should replace the shared database role and environment-based secrets with deployment-specific identities and managed secrets.

## Automated policy

With the stack running:

```sh
python3 scripts/verify_container_policy.py
```

The check fails when a service is unhealthy, a published port is not loopback-only, an application image runs as root, an application root filesystem is writable, resource bounds or security options are missing, a Dockerfile base is not digest-pinned, the backend network is not internal, or a sensitive configuration name is baked into an application image.

The complete build and runtime path is:

```sh
./scripts/verify_milestone3.sh
```

That command builds the images, starts the stack, runs both end-to-end suites and the cross-user isolation check, runs the notification tests against real Redis, restarts all seven containers, waits for readiness, and evaluates the container policy.

## SBOM and vulnerability policy

Run:

```sh
./scripts/scan_images.sh
```

Docker Scout writes one SPDX JSON SBOM and one SARIF vulnerability report per application image under `artifacts/security/`. The gate fails on any high or critical finding. The full SARIF report retains lower-severity findings so dependency refreshes can reassess them. Generated security reports are local artifacts and are not committed.

Base digest and dependency updates must be reviewed together. After changing either, rebuild without assuming a previous scan still applies, run `verify_milestone3.sh`, and regenerate every report with `scan_images.sh`.
