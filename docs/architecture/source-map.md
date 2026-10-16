# Evidence, assumptions and architecture decisions

[Index](../README.md) · [Gallery](README.md)

Reviewed on **16 October 2026** against application commit `1be7a60dedab3d76a619a0ad3bd33e91b6e06b81`. The app's tracked working tree was clean at inspection; `.vscode/` was untracked. No `.env` values or populated secret files were read for the pack. [Source hashes](sources/source-manifest.json) identify the reviewed files.

## Application sources

Application root: `/Users/bernardboateng/Desktop/Projects/DevOps/taskflow`.

| View | Source relative to application root | Supported facts |
|---|---|---|
| Docker | `docker-compose.yml`, five service `Dockerfile`s, `README.md` | Eight services, images/build contexts, network memberships, ports, named volumes, readiness and process restrictions |
| Browser/API | `frontend/src/lib/server-api.ts`, `docs/api-contract.md` | Same-origin frontend proxy and private backend URLs |
| Database/event boundary | `task-service/internal/store/postgres.go`, `task-service/internal/outbox/worker.go`, `task-service/internal/broker/rabbitmq.go` | Transactional outbox, leases/backoff, persistent publication and publisher confirmations |
| Notification ingestion | `notification-service/app/broker.py`, `notification-service/app/store.py` | Durable queue, ack/requeue/reject behavior, atomic Redis ingest, cap and seven-day TTL |
| Kubernetes | `kubernetes/*-deployment.yaml`, `*-service.yaml`, `*-pvc.yaml`, `storage-class.yaml`, `configmap.yaml`, `namespace.yaml` | Eight single-replica Recreate Deployments, eight ClusterIPs, three encrypted-gp3 claims and environment config |
| Ingress | `kubernetes/frontend-ingress.yaml`, `alb-ingress.yaml.example`, `nginx-controller-values.yaml.example` | Host, ingress classes, NGINX NodePort, exact backend Service and ALB TLS template |
| Migration | `kubernetes/README.md` | Previous StatefulSet migration, preserving bound claims and credentials, configuring examples |
| CI | `.github/workflows/ci.yml`, `docs/continuous-integration.md` | Required checks, image evidence, archives, exact-image integration and optional SonarQube |
| Local configuration | `scripts/setup.sh`, `.env.example` | Ignored configuration generation and exact configuration interface; no secret values recorded |

Direct entrypoints: [application README](/Users/bernardboateng/Desktop/Projects/DevOps/taskflow/README.md), [Compose](/Users/bernardboateng/Desktop/Projects/DevOps/taskflow/docker-compose.yml), [Kubernetes notes](/Users/bernardboateng/Desktop/Projects/DevOps/taskflow/kubernetes/README.md), [CI workflow](/Users/bernardboateng/Desktop/Projects/DevOps/taskflow/.github/workflows/ci.yml).

## Planning provenance

The user supplied the chat [“plan”](codex://threads/01a117e1-72c7-7f80-b71b-1846e336ed88). It describes AgriBridge, replaces EKS with kOps, and uses an 18-stage local-to-cloud delivery plan. This pack reuses that planning pattern for TaskFlow; it does not copy AgriBridge's React/Express topology or managed data layer into TaskFlow.

The current workspace's `TERRAFORM_TASKFLOW_GUIDE.md` is an older EKS reference. The application checkout has no corresponding `infrastructure/` directory. Files under `output/architecture/` predate the current Kubernetes revision and describe StatefulSets, a different folder layout and earlier storage/ingress inconsistencies. These files remain historical; the new pack records what was present at inspection.

## Decisions and boundaries

| Decision | Reason and implication |
|---|---|
| kOps on EC2 is the cloud direction | Matches the linked plan and current Kubernetes documentation; cluster provisioning remains future work |
| Keep Next.js as the only browser API entrypoint | Preserves current cookie/origin behavior and avoids exposing private backend endpoints |
| Preserve PostgreSQL, Redis and RabbitMQ initially | Matches implemented clients and Kubernetes manifests; replacing RabbitMQ with SQS needs code changes |
| Keep in-cluster data single-replica | Matches current controllers; this is a limited-availability starting point, not replicated data HA |
| Model public ALB and private cluster nodes | Proposed topology; requires actual VPC, route, IAM and cluster configuration |
| Preserve the two-controller ingress chain | Matches ALB and F5 NGINX templates; simplifies documenting the current intended route |
| Keep Terraform and kOps ownership explicit | Foundation and cluster managers must not compete over subnets, egress or cluster resources |
| ECR, OIDC publishing and CD are proposed | Current workflow retains GitHub artifacts and does not publish or deploy |
| Managed secrets and restore automation are proposed | Current local config and Kubernetes Secret template do not implement those integrations |

No cloud account was queried and no cluster or application runtime was tested for this pack. Capacity, account, region, domain ownership, supported version pair, backup methods, RPO/RTO and cost estimates are implementation inputs still to resolve.

## Primary documentation checked

These links support the proposed platform mechanisms. They are not evidence that resources exist in the user's account.

- [kOps on AWS](https://kops.sigs.k8s.io/getting_started/aws/): cluster setup, DNS and separate state/OIDC considerations.
- [kOps in an existing VPC](https://kops.sigs.k8s.io/run_in_existing_vpc/): reuse shared subnets and explicitly assign egress ownership.
- [kOps instance IAM](https://kops.sigs.k8s.io/iam_roles/): node/instance roles and explicit ECR access configuration.
- [Kubernetes StorageClasses](https://kubernetes.io/docs/concepts/storage/storage-classes/): binding and reclaim-policy semantics.
- [AWS Load Balancer Controller annotations](https://kubernetes-sigs.github.io/aws-load-balancer-controller/latest/guide/ingress/annotations/): instance targets, listener and certificate configuration.
- [kOps etcd backup and restore](https://kops.sigs.k8s.io/operations/etcd_backup_restore_encryption/): cluster-state recovery procedures.

Before implementation, recheck release support and addon compatibility against the selected kOps/Kubernetes pair. No unverified version was hard-coded into the proposed cloud plan.

## Artifact checks completed

All six diagrams were rendered and visually inspected. Each PNG decodes at 3600 × 2500; each SVG parses as XML and includes an accessible title/description. All six logical Mermaid companions are included; they were not rendered through a Mermaid parser. Seventy local document/image/source links resolved at packaging time. The generator checks text widths and card heights during rendering.

The diagrams' inventory was checked directly against YAML: eight Compose services, three named volumes, eight Kubernetes Deployments, eight Services and three 3Gi `taskflow-gp3` claims. All eight Deployments specify one replica and Recreate. SHA-256 hashes for 45 source files were rechecked after writing the pack. These checks validate the documentation artifacts and source consistency; they do not replace application, cluster or restore testing.
