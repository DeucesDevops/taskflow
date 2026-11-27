# Pipelines

| Workflow | What it does |
| --- | --- |
| `ci.yaml` | Matrix of frontend, auth, projects, tasks, and notifications. Each runs lint, typecheck, and tests. |
| `security.yaml` | Gitleaks, SonarQube when its token and host are configured, Trivy filesystem scan, Checkov with `config/policies`. |
| `build-push.yaml` | Build each service image, Trivy image scan, SPDX SBOM, then `azure/login` with OIDC and push to ACR. No client secret. |
| `terraform.yaml` | `fmt -check` and `validate` for every module and both roots. On a pull request, plan dev and production with OIDC. The plan job is skipped when the Azure client, tenant, subscription, or state storage settings are absent. |
| `deploy.yaml` | GitHub environment `production` approval, then rewrite the five image tags in `helm/taskflow/values-production.yaml` and push to `dev` for Argo CD. |

Service checks match the Dockerfiles and the README:

- Frontend and auth: `npm run typecheck` and `npm test`
- Projects: Maven `validate`, `compiler:compile`, and `verify` on Java 21
- Tasks: `gofmt`, `go vet`, `go test -race`, and `go build` on Go 1.26.6
- Notifications: `compileall` and `unittest` on Python 3.13

Node services have no separate ESLint config, so the TypeScript compiler is the lint step.

Argo CD watches `helm/taskflow` on `dev`. Production value files are `values.yaml` plus `values-production.yaml`. Dev uses `values.yaml` only.
