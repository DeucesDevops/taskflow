#!/bin/bash
set -euo pipefail

# shellcheck disable=SC1091
. "$(dirname "$0")/lib/common.sh"

ROOT="$(repo_root "$0")"
require_command terraform

terraform fmt -check -recursive "${ROOT}/terraform"

modules=(
  terraform/bootstrap
  terraform/modules/network
  terraform/modules/cluster
  terraform/modules/registry
  terraform/modules/dns
  terraform/modules/storage
  terraform/modules/identity
  terraform/modules/platform
  terraform/modules/postgres
  terraform/modules/redis
  terraform/environments/dev
  terraform/environments/production
)

for module in "${modules[@]}"; do
  log "validate ${module}"
  terraform -chdir="${ROOT}/${module}" init -backend=false -input=false
  terraform -chdir="${ROOT}/${module}" validate
done
