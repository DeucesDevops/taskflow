# Milestone 2 service contract

All JSON timestamps are ISO 8601 and IDs are UUIDs. Paginated collections return `{ "items": [...], "limit": 50, "offset": 0, "hasMore": false }`; the notification feed and project member list return `{ "items": [...] }`.
Errors return `{ "error": "safe human-readable message" }`.
All services expose GET /health (liveness), GET /ready (dependency readiness).
Browser uses Next.js same-origin /api routes; backend URLs remain server-only.
Internal backend ports: auth 3001, projects 8080, tasks 8081, notifications 8000.

## Auth
- POST /auth/register `{name,email,password}` -> 201 `{token,user:{id,name,email}}`.
- POST /auth/login `{email,password}` -> `{token,user:{id,name,email}}`; signed JWT with a revocable Redis session and 24h TTL.
- GET /auth/me with Authorization: Bearer TOKEN -> `{user:{id,name,email}}` (401 invalid, 503 unavailable).
- POST /auth/logout with bearer token -> 204.
- GET /auth/users?email=... and GET /auth/users/{id} return public profiles to authenticated service callers.
- Demo identity seeded in Postgres: UUID 11111111-1111-4111-8111-111111111111, name Alex Morgan; default email alex@taskflow.local, password taskflow-local-demo. Configurable via DEMO_EMAIL and DEMO_PASSWORD.
- AUTH_SERVICE_URL=http://auth-service:3001. Downstream services validate incoming bearer tokens through /auth/me using bounded timeouts; never trust browser-supplied user IDs.

## Projects
- GET /projects?limit=50&offset=0 -> `{items,limit,offset,hasMore}` for owned and joined active projects; each project includes caller `role`.
- POST /projects `{name,description?}` -> 201 project.
- GET/PATCH/DELETE /projects/{id} read, owner-update, or soft-archive a project.
- GET/POST /projects/{id}/members list or owner-add an existing account by email.
- GET/DELETE /projects/{id}/members/{userId} validate membership or owner-remove a member.
- DATABASE_URL=jdbc:postgresql://postgres:5432/taskflow, DB_USER=taskflow, DB_PASSWORD from env. Own schema projects. Seed one project for demo owner: id 22222222-2222-4222-8222-222222222222, name Platform launch, description Build the foundations of TaskFlow.

## Tasks
- GET /tasks?projectId=UUID&limit=50&offset=0 -> paginated task collection.
- GET/POST/PATCH/DELETE /tasks and /tasks/{id} provide CRUD, descriptions, status, and nullable member assignments.
- GET/POST /tasks/{id}/comments provide paginated discussion; author identity always comes from auth.
- Verify project membership through project-service before every read/write and validate assignments against current membership.
- DATABASE_URL=postgres://taskflow:PASSWORD@postgres:5432/taskflow?sslmode=disable. Own schema tasks.
- PROJECT_SERVICE_URL=http://project-service:8080.
- NOTIFICATION_SERVICE_URL=http://notification-service:8000.
- Store each mutation and its events atomically in PostgreSQL. A leased outbox worker retries with exponential backoff until POST /events returns 202.
- Event body {id:UUID,userId:UUID,type:"task.created"|"task.updated"|"task.deleted"|"task.commented"|"task.assigned",message:string,taskId:UUID,projectId:UUID,createdAt:ISO8601}.

## Notifications
- POST /events (internal key required) -> 202; writes to Redis list per user (max 100, 7-day TTL), idempotent event ID.
- GET /notifications (bearer token, validate with auth) -> items [{id,type,message,taskId,projectId,createdAt}], newest first.
- REDIS_URL=redis://redis:6379/0. INTERNAL_API_KEY environment required.

## Frontend proxy
- /api/auth/register and /api/auth/login set an httpOnly SameSite=Lax session cookie and return only `{user}`; never expose the bearer token to browser JavaScript.
- /api/auth/me GET returns {user}; /api/auth/logout POST returns 204 and clears session. If remote revocation fails, it returns 503 but still clears the browser cookie.
- Project, membership, task, assignment, archival and comment routes are explicit same-origin proxies.
- /api/notifications GET.
- /health GET, /ready GET.
- Forward cookie as bearer to backend. Mutation requests require a matching Origin header; missing or cross-origin headers return 403. Never allow arbitrary proxy targets. Use timeouts, no caching of user data, friendly errors.
