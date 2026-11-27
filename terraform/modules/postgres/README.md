# PostgreSQL Flexible Server

Optional managed replacement for the local Postgres 17 container. The server has no public endpoint. It uses the delegated `postgres` subnet and a private DNS zone linked to the VNet.

One database, `taskflow`, matches Compose. Auth, projects, and tasks still create their own schemas (`auth`, `projects`, `tasks`) at startup. The administrator login defaults to `taskflow`. The password is `TF_VAR_postgres_administrator_password` and is not stored in the repository.

Store that password in Key Vault under the name `postgres-password` so the application ExternalSecrets can build `DATABASE_URL` and `DB_PASSWORD`. See `docs/ADR/0003-data-services.md`.
