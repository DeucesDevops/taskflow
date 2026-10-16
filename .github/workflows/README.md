# Delivery workflows

ci.yml is the existing validation and exact-image integration workflow.

Reserved future files:

- publish.yml: promote the tested images to ECR using scoped GitHub OIDC credentials and retain image digest evidence (stage 12).
- deploy.yml: serialize environment deployments with scoped cluster access, rollout checks and production promotion controls (stage 13).

These workflows are not implemented. Add runnable workflow YAML only when the corresponding stage is ready.

See [the CI/CD plan](../../docs/plans/cicd/README.md).
