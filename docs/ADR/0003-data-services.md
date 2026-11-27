# ADR 0003: Postgres, Redis, and RabbitMQ

## Status

Accepted

## Context

Compose runs PostgreSQL 17, Redis 7.4, and RabbitMQ 4.1. The application reads `DATABASE_URL`, `DB_PASSWORD`, `REDIS_URL`, and `RABBITMQ_URL`. Production should not keep databases on node disks if a managed service is straightforward.

## Decision

PostgreSQL Flexible Server and Azure Cache for Redis are optional Terraform modules, enabled by default. Flexible Server is private, on a delegated subnet, major version 17 to match Compose. Azure Cache for Redis is private, TLS only, major version 6, which is the version that service offers. Clients already accept `redis://` and `rediss://`.

RabbitMQ stays in the cluster as a Bitnami Helm release. Azure Service Bus is not AMQP-compatible with the existing publisher and consumer, and there is no simple managed RabbitMQ in this subscription model. The broker password is random, stored in the in-cluster `broker` secret and in `rabbitmq-connection` for the apps. It is not written to a file.

Logical dumps go to the backup storage account containers `postgres`, `redis`, and `rabbitmq`.

## Consequences

Set `TF_VAR_postgres_administrator_password` before apply when Postgres is enabled, then store the same password in Key Vault as `postgres-password`. Store the Redis URL as `redis-url`. Disabling either module leaves the subnet in place and skips the resource. Dev uses a burstable Postgres SKU and a Basic Redis cache. Production uses General Purpose Postgres and Standard Redis.
