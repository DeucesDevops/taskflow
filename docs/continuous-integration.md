# Continuous integration

Milestone 4 adds one gated GitHub Actions workflow at `.github/workflows/ci.yml`. It runs for pull requests, `main`, milestone branches, release tags beginning with `v`, and manual dispatches.

## Pipeline

```text
source change
  ├─ workflow lint
  ├─ frontend / auth / Java / Go / Python checks
  ├─ Semgrep SAST
  └─ Trivy dependency, secret, and configuration scan
          │
          ▼
  five production image builds
          │
          ├─ SPDX JSON SBOM
          ├─ Trivy image report
          └─ high/critical vulnerability gate
                  │
                  ▼
        exact images exported once
                  │
                  ▼
          full-stack integration
```

The integration job loads the exact image archives that passed the image gates. It does not rebuild them. It then runs both smoke suites across RabbitMQ and Redis, cross-user isolation, the real-Redis notification tests, the container hardening policy, and restart checks.

All external actions are pinned to full commit SHAs. `scripts/lint_workflows.sh` downloads a fixed actionlint release from GitHub, verifies its SHA-256 checksum, and validates the workflow locally or in CI. Dependabot tracks workflow actions, application dependencies, and Docker bases.

## Reports

Each container job retains its SPDX JSON SBOM and SARIF vulnerability report for 30 days. The repository-level Trivy SARIF report is retained for 14 days. Image archives are retained for one day because they exist only to pass the already-scanned artifact to integration.

GitHub code scanning upload is deliberately not required: this is a private personal repository, where that feature requires GitHub Code Security. The SARIF files remain downloadable workflow artifacts. Semgrep and Trivy still fail the workflow directly when their policies are violated.

## Optional SonarQube

The mandatory SAST gate is Semgrep. SonarQube analysis is also wired and activates after these repository settings exist:

- Actions secret: `SONAR_TOKEN`
- Actions variable: `SONAR_HOST_URL`
- Actions variable: `SONAR_PROJECT_KEY`
- Optional Actions variable for SonarQube Cloud: `SONAR_ORGANIZATION`

Without that configuration, the SonarQube job records an explicit skip and the mandatory security gates continue to run.

## Required branch checks

After this workflow has run on GitHub, protect `main` and require at least:

- Workflow lint
- All five language checks
- Semgrep SAST
- Dependency, secret, and configuration scan
- All five container jobs
- Full-stack integration

## Local validation

Run the workflow linter and the existing Milestone 3 verification before pushing CI changes:

```sh
./scripts/lint_workflows.sh
./scripts/verify_milestone3.sh
./scripts/scan_images.sh
```

The local container commands use Docker Scout, while GitHub Actions uses Trivy and Syft so the hosted runner does not depend on Docker Desktop tooling.
