# Milestone 1 verification

Verified locally on 18 September 2026 using Docker Desktop / Docker Compose on Apple Silicon. The full stack was built and run with the real PostgreSQL and Redis containers. No cloud services were provisioned.

## Build and automated checks

- All five application images built successfully using their final Dockerfiles.
- Auth: 5 tests passed, including login/revocation, invalid credentials, safe dependency errors, rate limiting, and password hashing.
- Projects: 10 tests passed in the Maven Docker build. Live checks also verified the seeded project, authenticated create/get, input validation, missing tokens, and missing IDs.
- Tasks: 8 tests passed; Go race detection and vet passed. Coverage includes project isolation, invalid writes, bounded downstream calls, redirect behavior, and committed tasks surviving notification failure.
- Notifications: 5 API tests and 2 integration tests passed. Real Redis checks verified concurrent event deduplication, newest-first ordering, 100-item bounds, user separation, and expiration.
- Frontend: TypeScript checks and optimized production build passed.
- Public API smoke check passed: readiness/liveness, sign-in, httpOnly cookie, no bearer token in the response body, unauthenticated rejection, cross-origin mutation rejection, projects, tasks, status validation, notifications, and sign-out.
- Cross-user check passed using a temporary real account: other users cannot list/read the demo user's project, create its tasks, change existing tasks, or read its notification feed. Event ingestion without the internal key is rejected. The script removes its temporary account, task, and notifications.

## Browser and persistence

The browser flow covered sign-in, project selection/creation, task creation, status changes, and the activity feed. Desktop and 390-CSS-pixel mobile layouts were checked; the mobile page had no horizontal overflow. Browser console inspection reported no warnings or errors in that check. Final verification was performed in Chrome at the user's request.

A signed-in API client captured all three projects, three tasks, and six notifications. Every container was then removed with `docker compose down` and recreated with `docker compose up --wait`. The same session remained valid, and every captured record, status, and feed entry matched exactly. Chrome was reloaded afterwards and the saved persistence-check task was successfully moved to Done.

A refresh timing issue found during review was fixed by disabling project creation while the project list is loading. The final frontend image was rebuilt and checked in Chrome after the change.

After the UI refinement, the frontend passed another TypeScript check, production build, Docker rebuild, and full public API smoke check. Chrome checks covered the redesigned sign-in, password visibility toggle, sign-out/sign-in, task filtering and its empty state, and the New task focus action. The workspace was checked at 320, 768, 1024, and 1440 CSS pixels without horizontal overflow; the sign-in was visually checked at 320 and 1440 pixels. Chrome reported no warnings or errors in the final inspection. The normal browser viewport was restored afterwards.

The repository was moved into the local DevOps project folder. Compose was run from the new location and all seven containers remained healthy, retaining their existing named volumes and application data.

## Re-run

From the repository root:

```sh
docker compose up --build --wait
python3 scripts/smoke.py
docker compose exec -T auth-service node --input-type=module < scripts/check-isolation.mjs
docker compose ps
```

See the [notification service README](../notification-service/README.md) to run the real Redis integration tests. Build logs and the restart log from this run are available in the local, git-ignored `artifacts/` directory.

## Scope of the result

This verifies the local Milestone 1 path, not production deployment or load capacity. Notification delivery remains best-effort HTTP; feeds and sessions are local Redis data. The seeded demo account and initial schema bootstrap choices are documented in the root README. Later milestones have not been started.
