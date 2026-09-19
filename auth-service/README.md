# Auth service

Node.js and TypeScript own users in PostgreSQL's `auth` schema and revocable sessions in Redis. Registration and login return an HS256 JWT with minimal subject, session, issuer, audience, issued-at, and 24-hour expiry claims. Redis stores the public user under a hash of the full token, which allows immediate logout and keeps bearer values out of storage keys. Milestone 1 opaque sessions remain valid until their original expiry or logout.

Required environment: `DATABASE_URL`, `REDIS_URL`, and `JWT_SECRET` (at least 32 UTF-8 bytes). Demo seed settings are `DEMO_EMAIL` and `DEMO_PASSWORD`; existing seed rows are never overwritten. The service exposes registration, login, session lookup/logout, and authenticated public user lookup by email or UUID.

Startup applies numbered PostgreSQL migrations transactionally under an advisory lock. Existing Milestone 1 users are adopted without changing their profile or password hash. Passwords use salted scrypt hashes, normalized emails have a database-enforced case-insensitive unique constraint, and login/registration rate limits are shared through Redis.

```sh
npm ci
npm run build
npm test
```

The optional integration suite requires dedicated disposable PostgreSQL and Redis endpoints; it must not target the development stack because it owns its test data. The Docker build compiles TypeScript, runs the unit tests, installs production dependencies only, and starts the compiled Fastify server as a non-root user.
