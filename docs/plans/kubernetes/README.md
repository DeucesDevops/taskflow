# Kubernetes deployment plan

[Diagram](../../architecture/03-kubernetes-cluster.png) · [Stages 5–10](../implementation-plan.md)

## Current resource inventory

All eight components use `Deployment`, one replica and `Recreate`. Five application Deployments and three data Deployments have individual ClusterIP Services. The application namespace is `taskflow`; F5 NGINX is installed separately in `nginx-ingress`.

| Storage consumer | Claim | Request | Class |
|---|---|---|---|
| PostgreSQL | `postgres-data` | 3Gi RWO | `taskflow-gp3` |
| Redis | `redis-data` | 3Gi RWO | `taskflow-gp3` |
| RabbitMQ | `rabbitmq-data` | 3Gi RWO | `taskflow-gp3` |

The StorageClass uses `ebs.csi.aws.com`, gp3 encryption, `WaitForFirstConsumer`, expansion and `Retain`. Delayed binding lets scheduling choose a compatible volume location; EBS volumes remain AZ-bound. Retention protects against automatic volume reclamation after claim deletion, but does not supply an independent backup. See [Kubernetes StorageClasses](https://kubernetes.io/docs/concepts/storage/storage-classes/).

## Prerequisites

Have a validated kOps cluster, working CNI/DNS, restricted operator access, AWS Load Balancer Controller, EBS CSI with AWS permissions and F5 NGINX configured as NodePort. Pin compatible chart/addon versions after reviewing current upstream support. The source's NGINX example documents chart `2.7.3`; it is evidence of the existing configuration, not a newly verified version recommendation.

The source ALB backend is `taskflow-nginx-nginx-ingress-controller`, port 80, namespace `nginx-ingress`. Verify it against the installed chart's actual rendered Service. The ALB template specifies health path `/nginx-health`; the NGINX values enable that endpoint. Frontend ingress uses class `nginx` and targets Service `frontend:3000` for host `taskflow.deuces.dev`.

## Deployment order

1. Confirm cluster and addon readiness, target environment, image architecture and image pull permissions.
2. Review configured YAML and secret references. Set the exact `APP_ORIGIN`, bootstrap email and secure-cookie policy. Use private generated credentials or the planned secrets integration.
3. Create the namespace, runtime Secret, ConfigMap, StorageClass and claims.
4. Apply data Services/Deployments, wait for claims and data readiness, then application Services/Deployments.
5. Verify internal DNS and `/health`/`/ready`, then use the frontend for auth, project/task and notification checks.
6. Configure/apply the ALB example explicitly, configure DNS/ACM and enable frontend ingress. Confirm the public HTTPS path end to end.

The `.example` Secret and ALB files are skipped by `kubectl apply -f kubernetes/`; they require configured copies and explicit application. The application README permits applying the folder after setup, but a staged initial apply makes dependency and storage failures easier to inspect. No populated Secret is included in this pack.

## Upgrades and migration

The previous draft used StatefulSets. If an existing cluster still has them, follow the application's `kubernetes/README.md` migration sequence: back up, inspect actual bound claims, stop old data controllers and wait for termination before creating replacements. Do not run a StatefulSet and Deployment against the same database volume. Preserve credential values for initialized stores until an actual rotation is performed.

A bound claim's StorageClass cannot be changed in place. Existing `default` claims need an explicit migration or configuration matching their actual class. Do not delete claims to make an apply succeed.

`Recreate` introduces downtime; the current single-replica setup does not provide rolling availability. Increase only verified stateless workloads after testing concurrent schema migrations, outbox worker leasing, resource use and origin/session behavior. Keep all three current data Deployments at one replica.

## Exit evidence

Record rendered/validated configuration, actual image digests, all Deployment rollouts, bound PVCs, ingress target health, HTTPS/cookies, API behavior, member isolation, task notification delivery and restart persistence. Add a backup restore and worker-failure drill before calling the environment recoverable. Confirm the supported node/AZ placement for the actual EBS claims.
