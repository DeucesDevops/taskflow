# Scope and later milestones

Milestone 1 delivers the runnable polyglot workspace, service ownership boundaries, persistent local backing services, health/readiness checks, container builds, and basic integration verification.

Later work is intentionally not implemented here:

1. **APIs and data integration:** real user lifecycle, team memberships, richer project/task operations, pagination, versioned migrations for every service, and transactional event outbox.
2. **Tests and hardening:** broader integration/contract coverage, failure testing, vulnerability and image policies, and production identity/security design.
3. **CI:** language-specific test/build workflows and immutable image promotion.
4. **Terraform/AWS:** isolated environments, networking, managed state/data, secrets, and budget controls.
5. **EKS and Helm:** deployment configuration, resource sizing, autoscaling, and readiness policies.
6. **Argo CD/GitOps:** versioned environment configuration and controlled rollouts.
7. **Observability and DevSecOps:** correlated telemetry, dashboards, alerts, supply-chain checks, and operational runbooks.
8. **Backstage IDP:** catalog entries, templates, documentation, and platform workflows.

Keep application source inside its service boundary. Add deployment/CI/platform directories when the corresponding milestone starts, rather than carrying nonfunctional scaffolding now.
