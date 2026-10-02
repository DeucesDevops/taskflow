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

This section verifies the original local Milestone 1 path, not production deployment or load capacity. The Milestone 2 results below supersede its former notification and schema-bootstrap limitations.

## Dark mode update

Verified on 19 September 2026. The frontend TypeScript check, optimized production build, and Docker image rebuild passed. Chrome checks covered light-to-dark and dark-to-light switching, saved preference after reload, the signed-out form, signed-in workspace, task board, activity panel, and create-project dialog. The dark workspace and sign-in were checked at 320 CSS pixels without horizontal page overflow, and the normal browser viewport was restored after testing. Chrome reported no warnings or errors.

## Milestone 2 verification

Verified locally on 19 September 2026 against the preserved Milestone 1 PostgreSQL and Redis volumes. A PostgreSQL dump was captured in the git-ignored `artifacts` directory before applying migrations.

- Auth: build and 12 tests passed. A disposable PostgreSQL/Redis integration run verified legacy data preservation, case-insensitive concurrent registration, JWT expiry/tamper checks, Redis revocation, and repeatable startup.
- Projects: 30 Maven tests passed. The live stack verified owner/member access, profile lookup, project editing, team management, member task access, outsider isolation, and archival hiding the project from every member.
- Tasks: race-enabled Go tests and `go vet` passed. A disposable PostgreSQL integration run verified migration preservation, assignments/comments, transaction rollback when event persistence fails, concurrent outbox claims, lease recovery, stale acknowledgement rejection, and retry backoff.
- Notifications and frontend: Docker builds ran notification API tests, frontend type checking, and the production Next.js build. The browser showed the team workspace, task detail/comments dialog, assignment controls, project/member management, and archival controls in the existing dark theme.
- `scripts/smoke.py` passed the original workflow. `scripts/milestone2_smoke.py` passed registration, JWT cookies, pagination, editing, team membership, assignment, comments, isolation, notifications, and archival.
- With the notification container stopped, a task and event committed successfully. The outbox recorded a failed attempt, retained the same event, and delivered it after the notification service restarted.
- A full `docker compose down` followed by `docker compose up --wait` preserved seven users, nine projects, two memberships, eight tasks, two comments, sixteen delivered outbox entries, and the active session used by the check.

This verifies the local Milestone 2 workflow and recovery semantics. It does not establish Internet-facing security, production load capacity, external email delivery, backups, or managed cloud infrastructure.

## Milestone 3 verification

Verified locally on 19 September 2026 using Docker Desktop and Docker Compose on Apple Silicon.

- All five multi-stage application images rebuilt successfully from digest-pinned bases. Their build stages ran 12 auth tests, 30 project-service tests, the task-service Go suite, 6 notification API tests, and 4 frontend API-boundary tests; frontend type checking and its optimized production build also passed.
- The notification image ran all 8 tests against the real Compose Redis instance, including concurrent deduplication, newest-first ordering, the 100-item feed bound, user separation, and expiration.
- `scripts/smoke.py`, `scripts/milestone2_smoke.py`, and the cross-user isolation check passed against the hardened stack.
- The seven-container stack restarted in under one second and returned every service to healthy state. Existing named volumes remained attached.
- `scripts/verify_container_policy.py` confirmed health, non-root application users, read-only application roots, hardened temporary filesystems, dropped capabilities, `no-new-privileges`, CPU/memory/PID limits, loopback-only published ports, an internal backend network, digest-pinned Dockerfile bases, and no sensitive runtime configuration baked into application images.
- Docker Scout generated SPDX JSON SBOMs and SARIF reports for all five application images. The policy found no high or critical vulnerability after moving the Node services to distroless runtimes, moving notifications to Alpine Python, updating Tomcat and Go, and removing npm/pip tooling from runtime images. Full reports, including lower-severity findings, remain in the git-ignored `artifacts/security/` directory.

Re-run the build and runtime verification with `./scripts/verify_milestone3.sh`. Run `./scripts/scan_images.sh` separately to regenerate security reports and enforce the vulnerability threshold. These results cover the local containerized development deployment; production identity, TLS, secret delivery, backup/restore, load capacity, and orchestration controls remain later milestones.

## Milestone 4 verification

Milestone 4 adds a SHA-pinned GitHub Actions pipeline that validates all five language stacks, performs Semgrep SAST, scans repository dependencies/secrets/configuration with Trivy, builds each production image, generates an SPDX JSON SBOM and SARIF vulnerability report, and rejects high or critical image findings. The workflow exports each image only after its scan passes and loads those exact artifacts for the full local integration suite.

`scripts/lint_workflows.sh` verifies the workflow with a checksum-pinned actionlint release. The existing Milestone 3 verification remains the local parity check for build, runtime, restart, isolation, and container policy. CI does not publish images or deploy the application.

Verified locally on 20 September 2026:

- actionlint accepted the complete workflow without findings.
- Frontend tests, type checking, and production build passed; all 12 auth tests and its TypeScript build passed; all 30 Java tests passed; Go formatting, vet, race-enabled tests, and build passed; and all 8 Python tests passed with the 2 real-Redis cases skipped in the isolated unit run as designed.
- The first Trivy repository pass identified `CVE-2026-56852` in indirect `golang.org/x/text v0.29.0`. Updating `x/text` to `v0.39.0` and its compatible `x/sync` dependency made the repeated repository gate clean.
- `scripts/verify_milestone3.sh` rebuilt all five images and passed both end-to-end suites, cross-user isolation, all 8 notification tests against real Redis, restart recovery, and the container policy.
- Trivy 0.74.0 found no high or critical vulnerabilities in any of the five final images. Docker Scout independently regenerated all five SPDX/SARIF report sets and passed the same high/critical policy.

Hosted validation is triggered by pull requests, `main`, `milestone-*` branch pushes, release tags, or manual dispatch. The workflow performs validation only.

## RabbitMQ integration verification

Verified locally on 25 September 2026 with all eight Compose services running:

- `scripts/verify_milestone3.sh` rebuilt the application images, passed both end-to-end smoke suites, cross-user isolation, RabbitMQ consumer tests, real-Redis deduplication/feed tests, restart recovery, and the container policy.
- A task created in Chrome appeared immediately in the Activity feed after travelling through the PostgreSQL outbox, RabbitMQ, and Redis.
- With the notification consumer stopped, a second task created in Chrome produced one ready RabbitMQ message and a delivered outbox record. After the consumer restarted, the queue returned to zero ready/unacknowledged messages with one active consumer.
- Redis contained exactly one notification for each browser-created task, confirming recovery delivery and stable-ID deduplication.
