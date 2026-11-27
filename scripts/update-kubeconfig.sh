#!/bin/bash
set -euo pipefail

# shellcheck disable=SC1091
. "$(dirname "$0")/lib/common.sh"

ENVIRONMENT="${1:-}"
NAME_PREFIX="${NAME_PREFIX:-taskflow}"

case "${ENVIRONMENT}" in
  dev|production) ;;
  *) die "Usage: update-kubeconfig.sh <dev|production>" ;;
esac

require_command az
if ! az account show >/dev/null 2>&1; then
  die "az login is required before reading AKS credentials."
fi

az aks get-credentials \
  --resource-group "rg-${NAME_PREFIX}-${ENVIRONMENT}" \
  --name "aks-${NAME_PREFIX}-${ENVIRONMENT}" \
  --overwrite-existing
log "Updated kubeconfig for aks-${NAME_PREFIX}-${ENVIRONMENT}."
