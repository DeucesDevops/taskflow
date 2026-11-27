#!/bin/bash
set -euo pipefail

# shellcheck disable=SC1091
. "$(dirname "$0")/lib/common.sh"

ROOT="$(repo_root "$0")"
require_command az
require_command terraform

if ! az account show >/dev/null 2>&1; then
  die "az login is required before bootstrap."
fi

confirm_token "BOOTSTRAP_CONFIRM=apply" "BOOTSTRAP_CONFIRM=${BOOTSTRAP_CONFIRM:-}"

cd "${ROOT}/terraform/bootstrap"
terraform init -input=false -backend=false
terraform apply -input=false
log "Copy the backend_hcl output into terraform/environments/<name>/backend.hcl and set key."
