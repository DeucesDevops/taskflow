#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

if ! docker scout version >/dev/null 2>&1; then
  echo "Docker Scout is required. Install or enable it in Docker Desktop." >&2
  exit 1
fi

report_dir="${TASKFLOW_REPORT_DIR:-artifacts/security}"
mkdir -p "$report_dir/sbom" "$report_dir/cves"
policy_failed=0

for service in frontend auth-service project-service task-service notification-service; do
  image="taskflow-$service:latest"
  docker image inspect "$image" >/dev/null
  docker scout sbom --format spdx --output "$report_dir/sbom/$service.spdx.json" "local://$image" >/dev/null
  docker scout cves --format sarif --output "$report_dir/cves/$service.sarif" "local://$image" >/dev/null
  if ! docker scout cves \
    --format markdown \
    --output "$report_dir/cves/$service-policy.md" \
    --only-severity critical,high \
    --exit-code \
    "local://$image"; then
    policy_failed=1
  fi
done

echo "SPDX SBOMs and SARIF vulnerability reports written to $report_dir"
if [ "$policy_failed" -ne 0 ]; then
  echo "FAIL: at least one image has a high or critical vulnerability" >&2
  exit 1
fi

echo "PASS: no high or critical vulnerability was found"
