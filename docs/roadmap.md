# Completed scope and later milestones

Milestone 1 delivered the runnable polyglot workspace, service ownership boundaries, persistent local backing services, health/readiness checks, container builds, and basic integration verification.

Milestone 2 delivered functional APIs and data integration: registration and signed sessions, shared projects and member management, task CRUD and assignments, comments, pagination, versioned migrations, and a transactional notification outbox with retry recovery.

Milestone 3 delivered tests and container hardening: frontend API-boundary coverage, a repeatable full-stack verification command, digest-pinned multi-stage images, non-root and read-only application runtimes, bounded resources, private backend networking, real Redis integration coverage, graceful restart verification, SPDX SBOMs, SARIF reports, and a high/critical vulnerability gate.

Milestone 4 delivered continuous integration: language-native test/build jobs, workflow linting, Semgrep SAST, Trivy dependency/secret/configuration gates, independently built and scanned service images, SPDX SBOMs, a full-stack test of the exact scanned artifacts, optional SonarQube analysis, and automated dependency updates.

Later work is intentionally not implemented here:

5. **Production platform design:** choose and document infrastructure, orchestration, secrets, data, networking, and rollout strategies.
6. **Observability and DevSecOps:** correlated telemetry, dashboards, alerts, supply-chain checks, and operational runbooks.
7. **Platform self-service:** catalog entries, templates, documentation, and platform workflows.

Keep application source inside its service boundary. Add deployment and platform directories only when a new production-platform design is ready to implement.
