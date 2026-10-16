# CI/CD extension plan

[Diagram](../../architecture/05-delivery-pipeline.png) · [Stages 11–13](../implementation-plan.md)

## Current CI contract

The source workflow runs on pull requests, pushes to `main`/`milestone-*`, version tags and manual dispatch. Required image-build dependencies include workflow lint, frontend/auth/projects/tasks/notifications checks, Semgrep and Trivy repository scanning. The repository scan follows Java checks and resolves Maven dependencies.

Five production image jobs generate Syft SPDX SBOMs and Trivy SARIF reports, enforce HIGH/CRITICAL policy, then export image archives. Integration downloads those archives and starts Compose with `--no-build`, preserving artifact identity. It runs smoke, cross-user isolation, Redis-backed notification tests, runtime hardening and restart checks. SonarQube runs only when configured and is not a required image-build dependency.

Current CI uploads reports and temporary images as GitHub workflow artifacts. It has no registry publishing or cloud deployment stage. Branch-protection settings were not inspected by this task.

## Additions in order

| Work | Deliverable | Acceptance |
|---|---|---|
| Infrastructure validation | Format/validate foundation and render cluster configuration | Invalid configuration blocks merge without provisioning |
| Registry publishing | GitHub OIDC publisher scoped to intended ECR repositories | Trusted ref can publish; untrusted PR cannot |
| Artifact provenance | Commit SHA, tested image digest, reports and platform | Published image matches the validated artifact |
| Environment access | Runner reaches restricted Kubernetes API; scoped RBAC | Deploy role can update workloads without cluster-admin |
| Development rollout | Serialized deploy, rollout timeout and frontend smoke | Functional failure blocks promotion |
| Production promotion | Review gate and immutable digest selection | Same validated artifact is promoted |
| Rollback | Previous digest/configuration plus migration compatibility policy | Application rollback exercised in development |

Promote artifacts after successful integration instead of rebuilding a different image in a publishing job. If multi-platform images are introduced, test the platform that will run on the selected node architecture. Keep publishing permissions separate from foundation provisioning and cluster administration.

## Database and event constraints

The services own schema migrations. Decide whether to retain startup migrations or move compatible migration steps into a controlled deployment stage after inspecting each implementation. Test against a restored database. A previous container digest cannot reverse a destructive database change.

Rollback and restart may replay outbox messages; preserve stable event IDs and account for the seven-day Redis deduplication window. Publish retained release evidence without runtime credentials or connection URLs containing passwords.
