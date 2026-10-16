# TaskFlow implementation plan: Docker to AWS with kOps

[Index](../README.md) · [Folder structure](repository-structure.md)

This adapts the linked chat's 18-stage approach to TaskFlow. The source already implements the application, local containers and CI. Preserve those foundations; execute their verification gates before calling a new environment complete. Kubernetes YAML exists but has not been validated against a running cluster for this pack. AWS resources, kOps cluster definitions, application Helm packaging and deployment automation remain proposed.

| Phase | Stages | Outcome |
|---|---|---|
| Local baseline | 1–3 | Reproducible application in Docker Desktop |
| AWS and Kubernetes | 4–10 | Verified public HTTPS application on kOps |
| Delivery | 11–13 | Tested artifacts promoted and deployed with scoped credentials |
| Operations | 14–18 | Measured reliability, restoration, maintenance and handover |

## 1. Understand and baseline the application

**Status:** application and verification scripts exist. Inspect the five service boundaries, database schemas, sessions, project membership and transactional outbox. Record the source revision and actual runtime versions.

**Deliverable:** service/port/configuration inventory, diagram 01, and a local verification record. **Exit:** login, project/task collaboration, unauthorized-access rejection and activity feed work through the frontend. Use existing smoke and isolation checks; do not infer success from source alone.

## 2. Validate the Docker images

**Status:** five multi-stage Dockerfiles exist. Build using the repository's locked dependencies and included test stages. Check the real runtime identity, writable paths, graceful shutdown, resource limits and image reports. Recheck supported CPU architecture before moving from Apple Silicon development to AWS nodes.

**Deliverable:** reproducible images, SBOMs and vulnerability reports. **Exit:** focused build tests and required image gates pass; the final images start with the expected non-root identities. See [Docker](docker/README.md).

## 3. Verify the Compose environment

**Status:** eight-service Compose configuration exists. Use the setup script to create ignored configuration, then run the stack without disrupting other Docker projects. Keep frontend port configurable and preserve named volumes.

**Deliverable:** running local environment plus test evidence. **Exit:** health/readiness, smoke, collaboration/isolation, notifications, container policy and restart/persistence checks pass. Record the tested URL and version. Never use volume deletion as a routine restart.

## 4. Build the AWS foundation with Terraform

**Status:** proposed; current application checkout has no `infrastructure/` directory. Choose account, region, domain access, AZs, capacity and a cost ceiling. Bootstrap encrypted remote state and separate kOps state storage. Define VPC, subnet routes, NAT, ECR, security boundaries and resource tags.

**Deliverable:** `infrastructure/bootstrap`, reusable modules and environment roots. **Exit:** offline validation passes; reviewed plans create the intended foundation with explicit ownership and no duplicate kOps resources. See [AWS](aws/README.md).

## 5. Prepare the persistent data design

**Status:** plain manifests already define PostgreSQL, Redis and RabbitMQ Deployments and gp3 claims. Keep one replica per data Deployment. Specify storage size, backup strategy, capacity alerts and recovery objectives. Separate per-service database roles as a later hardening change.

**Deliverable:** storage/recovery configuration and a restore rehearsal plan. **Exit:** claims bind and remain usable after pod replacement; backup and restore prove application data survives. This is a learning deployment with single-instance data availability. Managed RDS/Redis or a replicated broker require a separate migration decision.

## 6. Provision the kOps cluster

**Status:** proposed. Save a pinned and compatible kOps/Kubernetes version pair, cluster spec and instance groups under `kops/`. Feed in Terraform-owned subnet IDs and explicitly reuse existing egress. Define cluster DNS, restricted API access, worker placement, CNI, encryption and etcd backup behavior.

**Deliverable:** reviewable `kops/` definitions and environment references. **Exit:** cluster validation passes; nodes, DNS and pod networking work; authorized operators and deployment runners can reach the API. For an HA target use three control-plane nodes across three AZs; document the smaller learning profile separately.

## 7. Install platform addons and secrets delivery

**Status:** prerequisites named in the manifests, installation not supplied. Install AWS Load Balancer Controller, EBS CSI, F5 NGINX and metrics-server with compatible pinned versions. Assign each addon one manager. Configure service-account AWS IAM for AWS-facing controllers; configure node image-pull access separately.

**Deliverable:** repeatable addon configuration and a secrets approach. **Exit:** a test claim provisions an encrypted volume; NGINX has the expected NodePort Service; controller permissions work without broad AWS credentials in application pods. Establish Secrets Manager + External Secrets Operator before production; do not commit populated Secret files.

## 8. Deploy the existing application manifests

**Status:** eight Deployment/Service pairs already exist. Set verified image references, exact `APP_ORIGIN`, bootstrap identity and runtime secrets. Configure namespace, storage and claims before data Deployments, then app Services/Deployments and ingress. If a previous StatefulSet installation exists, perform its documented migration first.

**Deliverable:** reproducible plain-YAML deployment and internal smoke record. **Exit:** all eight Deployments become ready, claims bind, Services resolve, and login/task/notification checks pass through a controlled frontend entrypoint. Verify migrations against a disposable restored dataset before using real data. See [Kubernetes](kubernetes/README.md).

## 9. Package the application with Helm if needed

**Status:** proposed and optional after stage 8. The current application resources are plain YAML; only the NGINX controller installation uses Helm. If multiple environments need application chart packaging, render the existing resource names, labels, ports and claim references from environment values.

**Deliverable:** `helm/taskflow/` and explicit environment values, only when implemented. **Exit:** rendered templates preserve the reviewed contracts; upgrade and application rollback work in development. Keep credentials outside values files and do not make claim deletion part of a routine uninstall.

## 10. Configure DNS, TLS and external access

**Status:** application ingress and an ALB template exist. Issue an ACM certificate in the ALB's region, configure the ALB template and DNS, and verify the actual NGINX Service name against the rendered controller chart. Keep the application and Kubernetes API endpoints separate.

**Deliverable:** HTTPS application URL. **Exit:** DNS and certificate validation succeed; HTTP redirects to HTTPS; ALB targets are healthy; frontend assets and same-origin API requests work; secure-cookie login/logout and origin checks pass. The current ALB-to-NGINX leg uses HTTP inside the VPC.

## 11. Establish required continuous integration

**Status:** workflow lint, language jobs, security gates and full-stack image integration exist. Preserve the current job graph and confirm required checks in repository settings. Add validation for Terraform, kOps definitions and any Helm chart as those artifacts are introduced.

**Deliverable:** source and infrastructure checks required before merge. **Exit:** an intentionally broken change fails the appropriate gate and a clean change passes. Documentation alone cannot confirm branch-protection settings. See [CI/CD](cicd/README.md).

## 12. Publish verified images

**Status:** proposed. Use GitHub OIDC with a publisher role scoped to the selected ECR repositories and trusted repository/ref. Promote the tested artifacts after integration rather than rebuilding different images. Record commit SHA, image digest and build reports together.

**Deliverable:** traceable images for all five application services. **Exit:** a clean runner and cluster node can pull the approved images; the published digest identifies the tested artifact; untrusted pull-request jobs cannot publish. Verify credentials and architecture selection independently.

## 13. Automate deployment and rollback

**Status:** proposed. Provide a runner with network reachability to the restricted Kubernetes API, scoped RBAC and separate deployment credentials. Serialize environment deployments. Use plain YAML initially or Helm only after stage 9 is ready. Define database migration compatibility and rollback limits.

**Deliverable:** development delivery plus reviewed production promotion. **Exit:** merge-to-development reaches a verified rollout; a failing deployment stops promotion; application rollback to a known digest works; production requires its configured approval. Database rollback needs a separate recovery decision.

## 14. Add observability

**Status:** process health, readiness and local logs exist; platform monitoring is proposed. Select metrics/logging tools and retention. Track latency/errors, failed readiness, outbox backlog/oldest event, queue depth/unacked messages, Redis memory, SQL storage/connections, node health, etcd and backup results. Add instrumentation where metrics do not yet exist.

**Deliverable:** useful dashboards, queries, alerts and owners. **Exit:** controlled dependency failure triggers the expected alert and lets an operator locate the cause. Do not assume every app already exposes Prometheus metrics.

## 15. Exercise resilience and scaling

**Status:** one replica and Recreate are current; HPA, disruption budgets and autoscaling are proposed. First identify stateless candidates, test concurrent migrations/outbox leasing and establish resource measurements. Use compatible rollout strategy, readiness, anti-affinity/spread and capacity before increasing app replicas.

**Deliverable:** load results and a measured scaling configuration. **Exit:** stateless replicas scale within limits, drained workers recover, and data pods recover in an AZ compatible with their volumes. Do not scale PostgreSQL, Redis or RabbitMQ Deployments above one; this does not create a replicated data cluster. Set disruption budgets only when replicas/capacity can satisfy them.

## 16. Harden and maintain the platform

**Status:** application container restrictions exist; cloud controls remain to implement. Define IAM/RBAC scope, workload identity, network policies, metadata restrictions, database privileges, internal transport policy and dependency updates. Configure Redis authentication/TLS with corresponding client changes before treating it as a secured production data service.

**Deliverable:** verified controls, ownership matrix and version/upgrade process. **Exit:** denied network/permission tests succeed as expected; the development cluster completes a reviewed rolling upgrade; application and backup checks pass afterward.

## 17. Test recovery and rollback

**Status:** proposed. Agree measurable RPO/RTO for SQL, sessions, feeds and queued events. Protect Terraform state, kOps state, etcd and application data independently. Restore into an isolated environment, then validate users/projects/tasks, outbox replay and notifications. Account for Redis dedup expiry and credential rotation.

**Deliverable:** timed restore evidence, backup schedule and recovery runbook. **Exit:** a full drill proves agreed recovery objectives; a known image rollback works; retained volumes and independent backups are both inventoried. See [Operations](operations/README.md).

## 18. Document, demonstrate and hand over

**Status:** this architecture pack supplies the diagrams and roadmap. Add implementation-specific commands, real resource outputs, validation results and operational owners as each stage completes.

**Deliverable:** reproducible runbooks, final diagrams, cost inventory and teardown instructions. **Exit:** another engineer can start locally, deploy development, trace an event, investigate an outage, restore data and identify all billable resources from the documentation.

## Immediate next work

Re-run stages 1–3 against the existing checkout, then complete stage 4's environment decisions and review the AWS foundation plan. The destination folders were scaffolded in the application on 16 October 2026 with README guidance and runbook outlines. Terraform, kOps, platform addon configuration, the optional application chart and publish/deploy workflows remain to implement; creating the folders does not satisfy the stage exit conditions.
