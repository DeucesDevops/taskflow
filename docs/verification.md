# Application checks

Run the focused tests from each service directory, then the Compose smoke checks from the repository root. Commands are in the [README](../README.md).

`scripts/smoke.py` checks liveness, readiness, sign-in, the httpOnly session cookie, unauthenticated access, cross-origin rejection, project creation, task status changes, notifications, and sign-out.

`scripts/milestone2_smoke.py` checks registration, pagination, project editing, membership, assignment, comments, isolation, notifications, and archival.

`scripts/check-isolation.mjs` uses a temporary account to confirm one user cannot list, read, or change another user's project, tasks, or notification feed. It removes the temporary records when it finishes.

Notification Redis tests are skipped unless `NOTIFICATION_TEST_REDIS_URL` points at a disposable Redis database. They check deduplication, ordering, the 100-item cap, user separation, and expiry.

The auth integration suite and the task-service PostgreSQL test are opt-in and must target disposable databases, not the Compose development volume.
