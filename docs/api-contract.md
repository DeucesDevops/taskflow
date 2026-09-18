# Milestone 1 service contract

All JSON timestamps are ISO 8601. IDs are UUIDs. Collections return `{ "items": [...] }`.
Errors return `{ "error": "safe human-readable message" }`.
All services expose GET /health (liveness), GET /ready (dependency readiness).
Browser uses Next.js same-origin /api routes; backend URLs remain server-only.
Internal backend ports: auth 3001, projects 8080, tasks 8081, notifications 8000.

## Auth
- POST /auth/login `{email,password}` -> `{token,user:{id,name,email}}`; opaque Redis session, 24h TTL.
- GET /auth/me with Authorization: Bearer TOKEN -> `{user:{id,name,email}}` (401 invalid, 503 unavailable).
- POST /auth/logout with bearer token -> 204.
- Demo identity seeded in Postgres: UUID 11111111-1111-4111-8111-111111111111, name Alex Morgan; default email alex@taskflow.local, password taskflow-local-demo. Configurable via DEMO_EMAIL and DEMO_PASSWORD.
- AUTH_SERVICE_URL=http://auth-service:3001. Downstream services validate incoming bearer tokens through /auth/me using bounded timeouts; never trust browser-supplied user IDs.

## Projects
- GET /projects -> items [{id,name,description,ownerId,createdAt}]; owned projects only.
- POST /projects `{name,description?}` -> 201 project.
- GET /projects/{id} -> project; 404 if absent or not owned.
- DATABASE_URL=jdbc:postgresql://postgres:5432/taskflow, DB_USER=taskflow, DB_PASSWORD from env. Own schema projects. Seed one project for demo owner: id 22222222-2222-4222-8222-222222222222, name Platform launch, description Build the foundations of TaskFlow.

## Tasks
- GET /tasks?projectId=UUID -> items [{id,projectId,title,status,createdAt,updatedAt}].
- POST /tasks `{projectId,title}` -> 201 task (default status todo).
- PATCH /tasks/{id} `{status}` -> task; statuses todo, in_progress, done.
- Verify project ownership via project-service GET /projects/{id}, forwarding bearer token, before all reads/writes.
- DATABASE_URL=postgres://taskflow:PASSWORD@postgres:5432/taskflow?sslmode=disable. Own schema tasks.
- PROJECT_SERVICE_URL=http://project-service:8080.
- NOTIFICATION_SERVICE_URL=http://notification-service:8000.
- After creating/updating task, POST /events with X-Internal-Key: INTERNAL_API_KEY; best-effort notification delivery, failure logged without undoing committed task. Document this milestone limitation (no transactional outbox yet).
- Event body {id:UUID,userId:UUID,type:"task.created"|"task.updated",message:string,taskId:UUID,projectId:UUID,createdAt:ISO8601}.

## Notifications
- POST /events (internal key required) -> 202; writes to Redis list per user (max 100, 7-day TTL), idempotent event ID.
- GET /notifications (bearer token, validate with auth) -> items [{id,type,message,taskId,projectId,createdAt}], newest first.
- REDIS_URL=redis://redis:6379/0. INTERNAL_API_KEY environment required.

## Frontend proxy
- /api/auth/login POST sets httpOnly sameSite=lax session cookie, returns {user}; do not expose bearer to browser JS.
- /api/auth/me GET returns {user}; /api/auth/logout POST returns 204 and clears session. If remote revocation fails, it returns 503 but still clears the browser cookie.
- /api/projects GET/POST; /api/projects/{id} GET.
- /api/tasks GET/POST; /api/tasks/{id} PATCH.
- /api/notifications GET.
- /health GET, /ready GET.
- Forward cookie as bearer to backend. Mutation requests require a matching Origin header; missing or cross-origin headers return 403. Never allow arbitrary proxy targets. Use timeouts, no caching of user data, friendly errors.
