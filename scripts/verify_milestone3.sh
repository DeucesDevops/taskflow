#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

docker compose config --quiet
docker compose build
docker compose up --detach --force-recreate --wait
python3 scripts/smoke.py
python3 scripts/milestone2_smoke.py
docker compose exec -T auth-service node --input-type=module < scripts/check-isolation.mjs
docker run --rm --network taskflow_backend \
  -e NOTIFICATION_TEST_REDIS_URL=redis://redis:6379/0 \
  -v "$PWD/notification-service/tests:/tests:ro" \
  taskflow-notification-service python -m unittest discover -s /tests -v
docker compose restart
docker compose up --detach --wait
python3 scripts/verify_container_policy.py

echo "PASS: Milestone 3 build, runtime policy, isolation, and end-to-end checks passed"
