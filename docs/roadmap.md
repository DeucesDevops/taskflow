# Completed scope and later milestones

Milestone 1 delivered the runnable polyglot workspace, service ownership boundaries, persistent local backing services, health/readiness checks, container builds, and basic integration verification.

Milestone 2 delivers functional APIs and data integration: registration and signed sessions, shared projects and member management, task CRUD and assignments, comments, pagination, versioned migrations, and a transactional notification outbox with retry recovery.

Later work is intentionally not implemented here:

3. **Tests and hardening:** broader integration/contract coverage, failure testing, vulnerability and image policies, and production identity/security design.
4. **CI:** language-specific test/build workflows and immutable image promotion.
5. **Terraform/AWS:** isolated environments, networking, managed state/data, secrets, and budget controls.
6. **EKS and Helm:** deployment configuration, resource sizing, autoscaling, and readiness policies.
7. **Argo CD/GitOps:** versioned environment configuration and controlled rollouts.
8. **Observability and DevSecOps:** correlated telemetry, dashboards, alerts, supply-chain checks, and operational runbooks.
9. **Backstage IDP:** catalog entries, templates, documentation, and platform workflows.

Keep application source inside its service boundary. Add deployment/CI/platform directories when the corresponding milestone starts, rather than carrying nonfunctional scaffolding now.
