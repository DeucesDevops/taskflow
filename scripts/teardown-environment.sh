#!/bin/bash
set -euo pipefail

# shellcheck disable=SC1091
. "$(dirname "$0")/lib/common.sh"

ROOT="$(repo_root "$0")"
ENVIRONMENT="${1:-}"

case "${ENVIRONMENT}" in
  dev|production) ;;
  *) die "Usage: teardown-environment.sh <dev|production>" ;;
esac

require_command terraform
require_command az
if ! az account show >/dev/null 2>&1; then
  die "az login is required before teardown."
fi

confirm_token "TEARDOWN_CONFIRM=destroy-${ENVIRONMENT}" "TEARDOWN_CONFIRM=${TEARDOWN_CONFIRM:-}"

ENV_DIR="${ROOT}/terraform/environments/${ENVIRONMENT}"
if [ ! -f "${ENV_DIR}/backend.hcl" ]; then
  die "Missing ${ENV_DIR}/backend.hcl."
fi

cd "${ENV_DIR}"
terraform init -input=false -backend-config=backend.hcl
terraform destroy -input=false -auto-approve
log "Destroyed ${ENVIRONMENT}. The bootstrap state resource group was left in place."
