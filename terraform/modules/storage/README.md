# Storage

Backup storage account and private blob containers for PostgreSQL, Redis, and RabbitMQ logical dumps. The account name has no dashes. Shared keys and public blob access are disabled. Callers authenticate with Entra ID.

This account is not the Terraform state account. State is created by `terraform/bootstrap`.
