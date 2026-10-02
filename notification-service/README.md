# Notification service

Python 3.13 and FastAPI consume task events from RabbitMQ and expose the signed-in user's notification feed. Redis keeps the newest 100 entries per user. The feed expires after seven days without new events; event IDs are deduplicated for seven days. Ingestion uses an atomic Lua script so simultaneous redelivery cannot create duplicate entries.

Required environment: `REDIS_URL`, `AUTH_SERVICE_URL`, `RABBITMQ_URL`, and `RABBITMQ_QUEUE`. The container listens on port 8000. `GET /health` checks liveness; `GET /ready` checks Redis, RabbitMQ, and auth readiness. The RabbitMQ consumer accepts `task.created`, `task.updated`, `task.deleted`, `task.commented`, and `task.assigned`; it acknowledges only after Redis stores the event. `GET /notifications` validates the bearer session through auth. Event ingestion is not exposed over HTTP.

The Docker build runs API tests. To include the real Redis integration tests after the Compose stack is running, from the repository root:

```sh
docker run --rm --network taskflow_backend \
  -e NOTIFICATION_TEST_REDIS_URL=redis://redis:6379/0 \
  -v "$PWD/notification-service/tests:/tests:ro" \
  taskflow-notification-service python -m unittest discover -s /tests -v
```

Integration tests use unique Redis key prefixes and remove their own test keys. Host-based development requires Python 3.13:

```sh
python3.13 -m venv .venv
.venv/bin/pip install --require-hashes -r requirements.txt
.venv/bin/python -m unittest discover -s tests -v
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
```

`requirements.in` holds direct dependency ranges; `requirements.txt` locks every resolved package and hash. Regenerate intentionally with `uv pip compile requirements.in --python-version 3.13 --generate-hashes --output-file requirements.txt`, then rebuild/test. The final image contains the tested app and virtual environment, not tests or build caches. It runs as UID/GID 65532.
