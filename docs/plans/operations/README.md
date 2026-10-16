# Operations, recovery and teardown plan

[Diagram](../../architecture/06-platform-operations.png) · [Stages 14–18](../implementation-plan.md)

## Runtime configuration and rotation

Current local development uses an ignored `.env`; Kubernetes uses a ConfigMap and a Secret template. Proposed AWS delivery uses Secrets Manager and External Secrets Operator with narrowly scoped workload IAM. Secrets injected as environment variables require a workload restart to refresh. Rotating a Kubernetes Secret does not rotate the actual PostgreSQL or RabbitMQ account password; coordinate the stores and clients.

The current Redis server has no configured authentication/TLS. Introduce server and client changes together if moving to authenticated/encrypted Redis. Redis is a session and notification store, so an outage can block auth or activity delivery and a data reset can revoke sessions and erase feeds.

## Signals and response

| Signal | Investigate | Recovery verification |
|---|---|---|
| Frontend/API error or failed readiness | Proxy URL, origin config, auth and dependency reachability | Login, representative task operation and unauthenticated rejection |
| Outbox oldest-event age or backlog | Task-service publisher, SQL leases, broker availability | Pending events drain without lost task records |
| Queue depth or unacked growth | Consumer readiness, malformed events, Redis failures | Delivery resumes and duplicate handling is understood |
| SQL storage/connections | Capacity, slow queries, migrations and role permissions | Project/task queries and transactional writes |
| Redis memory/evictions | Feed/session footprint, AOF and retention | Session behavior and new activity delivery |
| Worker or control-plane trouble | Node resources, DNS/CNI, etcd, credentials and API access | Cluster validation, ready pods and public smoke |
| Backup failure | Store access, retention, job failure and last successful restore | Restore into an isolated target |

These are proposed alert requirements. Implement metrics/exporters where needed; current `/health`, `/ready` and logs do not by themselves supply all listed metrics. Define notification recipients and response owners during implementation.

## Distinct recovery assets

| Asset | Restores | Does not restore |
|---|---|---|
| Terraform state | Foundation resource mapping and metadata | Application records or data volume contents |
| kOps state | Cluster specification and lifecycle state | All application data |
| etcd backup | Kubernetes API objects/state at the backup point | PostgreSQL/Redis/RabbitMQ disk contents |
| PostgreSQL backup | Users, projects, tasks, schemas and outbox | Redis sessions/feeds or live broker state |
| Redis recovery data | Sessions, user feeds and deduplication keys within retained state | SQL records |
| RabbitMQ recovery strategy | Definitions and queued data according to the chosen method | Events no longer present in SQL outbox or backups |
| Release evidence | Tested image digests and matching configuration | A compatible database automatically |

Choose application-aware backup methods and independent protected storage. Define schedules, retention, encryption, access and RPO/RTO per asset. Quiesce or use supported snapshot/backup procedures; independent storage snapshots taken at different moments are not automatically a consistent recovery point. See [kOps etcd backup and recovery](https://kops.sigs.k8s.io/operations/etcd_backup_restore_encryption/).

## Restore rehearsal

1. Pick a dated backup set and an isolated account/namespace/network with separate data and endpoints. Prevent restored workloads from consuming the live queue or writing live data.
2. Recreate the required infrastructure and cluster configuration; restore Kubernetes objects using the selected cluster recovery procedure.
3. Restore SQL with compatible schema/app versions. Restore or intentionally rebuild Redis and broker state according to the agreed recovery policy.
4. Start workloads with environment-specific credentials and origin settings. Validate record counts and representative users/projects/tasks, sessions, queue processing and activity feeds.
5. Test replay after publisher/consumer restart, including the effect of missing or expired deduplication keys. Define any required reconciliation instead of assuming replay is harmless forever.
6. Record actual data loss and restore duration against agreed objectives. Keep the recovery environment isolated until sign-off, then clean it up.

## Maintenance and teardown

Upgrade development first, preview kOps changes, confirm backups, run rolling updates, validate cluster health and retest the public app. Upgrade app dependencies, images and addons on an explicit cadence with retained rollback evidence.

For teardown, inventory owners and backups first. Remove ingress resources while their controllers can still clean up ALBs. Remove workload/addon resources in ownership order, then remove the kOps cluster, then the Terraform foundation after reviewing retained dependencies. The exact commands depend on implemented resource names and are deliberately deferred to the concrete runbook.

Inspect retained EBS volumes, snapshots, ALBs, NAT gateways, Elastic IPs, registry images, log groups and state/backup stores after deletion. `Retain` can leave volumes billable. Preserve state and backup assets until recovery obligations are met; do not blindly destroy all storage or use local `--volumes` as a cleanup shortcut.
