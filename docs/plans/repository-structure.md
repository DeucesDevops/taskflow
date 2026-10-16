# Repository and documentation structure

[Index](../README.md) · [Implementation plan](implementation-plan.md)

The documentation workspace is `/Users/bernardboateng/Documents/ChatGPT/Taskflow`. The application is `/Users/bernardboateng/Desktop/Projects/DevOps/taskflow`. The folder scaffold below was added to the application on **16 October 2026**, along with this architecture/planning pack. Existing service folders, manifests, CI and application documentation were preserved.

## Current application folders to preserve

```text
taskflow/
├── frontend/                 Next.js + TypeScript; same-origin API proxy
├── auth-service/             Node.js + TypeScript; identity and sessions
├── project-service/          Java + Spring Boot; projects and membership
├── task-service/             Go; tasks and transactional outbox
├── notification-service/     Python + FastAPI; RabbitMQ consumer and Redis feeds
├── kubernetes/               Plain YAML: 8 Deployments, 8 Services, config and storage
├── scripts/                  Existing setup, smoke, isolation and hardening checks
├── docs/                     Existing contracts, architecture and verification notes
├── .github/workflows/ci.yml  Existing validation and exact-image integration
├── docker-compose.yml       8-service local stack
└── .env.example              Names and non-secret configuration examples
```

Keep each service's Dockerfile inside its own existing service folder. Keep the current plain Kubernetes filenames and resource identities until an explicit packaging/refactor stage; avoid parallel live definitions that manage the same workload.

## Scaffold and implementation destinations

The directories below now exist and contain README guidance (or a Git placeholder in the reserved chart templates directory). Infrastructure and deployment configuration remain future work. `cluster.yaml`, `instancegroups.yaml`, `Chart.yaml`, `values.yaml`, `publish.yml` and `deploy.yml` are planned filenames, not executable placeholders. Runbooks are outlines pending concrete implementation and verification. Existing documentation was retained alongside the new pack.

```text
taskflow/
├── infrastructure/                    Terraform-owned AWS foundation
│   ├── README.md
│   ├── bootstrap/                     State stores; scoped CI identity bootstrap
│   ├── modules/
│   │   ├── networking/                VPC, shared subnets, routing, NAT
│   │   ├── registry/                  ECR repositories and lifecycle
│   │   ├── state-storage/             Private state and backup storage
│   │   ├── workload-iam/              Controller/service-account integrations
│   │   └── monitoring/                Chosen cloud alarms and notifications
│   └── environments/
│       ├── dev/                       Separate backend and variables
│       ├── staging/
│       └── production/
├── kops/                              kOps-owned cluster definitions
│   ├── README.md
│   ├── environments/
│   │   ├── dev/                       cluster.yaml; instancegroups.yaml
│   │   ├── staging/
│   │   └── production/
│   └── addons/                        Only addons explicitly assigned to kOps
├── kubernetes/                        Preserve existing application manifest names
├── platform/                          Proposed independent addon release config
│   ├── ingress/                       F5 NGINX and ALB-controller config
│   ├── storage/                       EBS CSI installation/configuration
│   ├── secrets/                       External Secrets Operator and references
│   └── observability/                 Chosen metrics/logging/alert configuration
├── helm/                              Reserved for optional stage 9
│   └── taskflow/                      Chart.yaml, values.yaml, templates/
├── .github/workflows/
│   ├── ci.yml                         Extend existing validation, keep artifact flow
│   ├── publish.yml                    Proposed verified-image promotion
│   └── deploy.yml                     Proposed scoped application deployment
└── docs/
    ├── architecture/                  These six views and evidence
    ├── plans/                         Implementation and ownership plans
    ├── runbooks/                      Concrete commands once implemented
    │   ├── local-development.md
    │   ├── cluster-deployment.md
    │   ├── upgrades.md
    │   ├── backup-restore.md
    │   └── teardown.md
    └── verification/                  Dated results, revision and environment
```

## Resource ownership

| Owner | Owns | Boundary |
|---|---|---|
| Docker Compose | Local containers, networks and named volumes | Local development only |
| Terraform | Foundation VPC/subnets/routes/egress, ECR, storage and agreed IAM integration | Reuse foundation IDs in kOps; do not independently recreate cluster EC2/ASGs |
| kOps | Cluster configuration, EC2 instance groups, control plane, cluster IAM/API and lifecycle | Shared network ownership must be explicit |
| AWS Load Balancer Controller | ALB and reconciled load-balancer resources | Terraform should not also manage that same application ALB |
| EBS CSI | Dynamic volumes from PVCs | StorageClass and claim names are the workload contract |
| Kubernetes manifests | Current application Deployments, Services, config, PVCs and ingress | Preserve names during migration |
| Helm, when adopted | Assigned addon releases; optionally the app chart | One owner per addon/resource; avoid applying competing app YAML |
| GitHub Actions | Validation, future artifact promotion and rollout orchestration | CI publisher is separate from cluster administration |

Never add populated `.env`, private kubeconfigs, state files, secret YAML or generated credentials to these tracked folders. Keep non-secret configuration and secret references reviewable.
