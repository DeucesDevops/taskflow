# Backup and restore

Flexible Server keeps automated backups for the retention set on the environment (14 days in production, 7 in dev). Restore a server from the Azure portal or CLI into a new server, then point `postgres.host` at the new FQDN.

Redis is a cache of sessions and notification feeds. Restoring it is optional. Users sign in again if it is empty. The feed TTL in the application is seven days.

RabbitMQ messages sit on a Premium SSD PVC (`managed-csi-premium`). A logical export can be copied to the `rabbitmq` blob container. The broker password is in the `broker` secret in the `rabbitmq` namespace.

The backup storage account does not allow anonymous blob access. Use `az storage blob upload --auth-mode login`.
