# AWS foundation and kOps plan

[Diagram](../../architecture/02-aws-kops-architecture.png) · [Stages 4–7](../implementation-plan.md)

The initial AWS target runs kOps-managed Kubernetes on EC2 and keeps PostgreSQL, Redis and RabbitMQ inside Kubernetes. The old EKS/RDS/ElastiCache/SQS guide is a separate design. Moving to managed databases or SQS needs application compatibility and data-migration work; it is not a diagram substitution.

## Decisions required before provisioning

| Decision | Working direction | Must be recorded |
|---|---|---|
| Account and region | Dedicated project scope | Account, region, quotas and operator identity |
| Environment | Development first | Budget, uptime target and teardown date |
| Network | Public ALB tier; private node tier | CIDRs, non-overlap, AZs, routes and egress |
| Cluster availability | Smaller learning profile or 3-AZ HA control plane | Node count/types, supported versions and failure limits |
| Application DNS | Current manifests use `taskflow.deuces.dev` | Domain authority, provider and certificate validation access |
| Cluster DNS/API | Separate cluster identity and restricted API endpoint | DNS mode, API ingress and runner/operator access |
| Registry | Current Docker Hub tags; ECR proposed | Repository names, CPU platforms, retention and pull permissions |
| Data recovery | Single-replica data in the first deployment | Volume sizes, retention, independent backups and RPO/RTO |

These are inputs to a concrete implementation plan; no account, price or deployed resource was inspected here. Produce a current cost estimate before applying an AWS plan. Track EC2/EBS, ALB, NAT/data transfer, registry storage and observability costs.

## Foundation outputs

Terraform should expose VPC/subnet IDs, route/egress references, ECR repository URLs, private state locations and agreed controller IAM roles. Keep Terraform state and kOps state separately scoped, encrypted and versioned. Keep public OIDC discovery objects separate from private cluster state.

kOps can use an existing VPC and subnets, with explicit shared egress settings. This is the basis for avoiding duplicate networking ownership. See [kOps existing VPC guidance](https://kops.sigs.k8s.io/run_in_existing_vpc/).

## Traffic and network policy

1. Public DNS resolves the application ALB; ACM terminates TLS.
2. ALB instance targets reach the NGINX NodePort, restricted by security-group policy.
3. NGINX routes the host to frontend Service port 3000.
4. The frontend calls private backend Services. The browser has no direct backend route.
5. Private nodes use explicitly configured egress for image pulls and required AWS endpoints.

The ALB template's `instance` target mode requires a NodePort backend. Validate healthcheck behavior and the rendered Service before exposing the application. See [AWS controller annotations](https://kubernetes-sigs.github.io/aws-load-balancer-controller/latest/guide/ingress/annotations/).

## Identity boundaries

Use short-lived operator credentials and separate CI publishing/deployment roles. Define node registry-pull permissions independently from pod roles. kOps does not grant ECR access by default; review an explicit registry-access policy when adopting ECR. Controllers needing AWS APIs should use scoped service-account roles through the selected kOps OIDC/IRSA configuration. Avoid copying EKS Pod Identity associations from the older guide into this kOps design. See [kOps IAM guidance](https://kops.sigs.k8s.io/iam_roles/).

## Validation sequence

Validate Terraform without provisioning, then review the environment plan and ownership map. After the approved foundation exists, generate/review the kOps cluster specification, preview cluster changes, and validate the created cluster. Test DNS, egress, registry pulls, API access, CSI volume provisioning and ALB reconciliation before app deployment. Save outputs and validation evidence without secrets.
