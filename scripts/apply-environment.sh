#!/bin/bash
set -euo pipefail

# shellcheck disable=SC1091
. "$(dirname "$0")/lib/common.sh"

ROOT="$(repo_root "$0")"
ENVIRONMENT="${1:-}"
ACTION="${2:-apply}"

case "${ENVIRONMENT}" in
  dev|production) ;;
  *) die "Usage: apply-environment.sh <dev|production> [plan|apply]" ;;
esac

case "${ACTION}" in
  plan|apply) ;;
  *) die "Action must be plan or apply." ;;
esac

require_command terraform
require_command az

if ! az account show >/dev/null 2>&1; then
  die "az login is required before planning or applying an environment."
fi

ENV_DIR="${ROOT}/terraform/environments/${ENVIRONMENT}"
if [ ! -f "${ENV_DIR}/backend.hcl" ]; then
  die "Missing ${ENV_DIR}/backend.hcl. Copy backend.hcl.example and fill it from the bootstrap output."
fi

cd "${ENV_DIR}"
terraform init -input=false -backend-config=backend.hcl

if [ "${ACTION}" = "plan" ]; then
  terraform plan -input=false
  exit 0
fi

confirm_token "APPLY_CONFIRM=apply" "APPLY_CONFIRM=${APPLY_CONFIRM:-}"

log "Stage 1: resource group, network, AKS, registry, DNS, storage, and identity."
terraform apply -input=false -auto-approve \
  -target=azurerm_resource_group.this \
  -target=module.network \
  -target=module.cluster \
  -target=module.registry \
  -target=module.dns \
  -target=module.storage \
  -target=module.identity

log "Stage 2: kubeconfig, storage class, remaining Terraform, issuer, and secret store."
"${ROOT}/scripts/update-kubeconfig.sh" "${ENVIRONMENT}"
require_command kubectl
kubectl apply -f "${ROOT}/platform/storageclasses/managed-csi-premium.yaml"
terraform apply -input=false -auto-approve

require_command python3
require_command envsubst
DOMAIN_NAME="$(terraform output -raw domain_name)"
KEY_VAULT_URI="$(terraform output -raw key_vault_uri)"
DNS_RESOURCE_GROUP="$(terraform output -raw resource_group_name)"
CERT_MANAGER_CLIENT_ID="$(terraform output -json workload_identity_client_ids | python3 -c 'import json,sys; print(json.load(sys.stdin)["cert_manager"])')"
SUBSCRIPTION_ID="$(az account show --query id -o tsv)"
export DOMAIN_NAME KEY_VAULT_URI DNS_RESOURCE_GROUP CERT_MANAGER_CLIENT_ID
export AZURE_SUBSCRIPTION_ID="${SUBSCRIPTION_ID}"
export ACME_EMAIL="${ACME_EMAIL:-admin@example.com}"

render_dir="$(mktemp -d)"
trap 'rm -rf "${render_dir}"' EXIT
# Placeholders stay literal so envsubst, not the shell, replaces them.
# shellcheck disable=SC2016
envsubst '${DOMAIN_NAME} ${DNS_RESOURCE_GROUP} ${AZURE_SUBSCRIPTION_ID} ${CERT_MANAGER_CLIENT_ID} ${ACME_EMAIL}' \
  < "${ROOT}/platform/cert-manager/cluster-issuer.yaml" > "${render_dir}/cluster-issuer.yaml"
# shellcheck disable=SC2016
envsubst '${KEY_VAULT_URI}' \
  < "${ROOT}/platform/external-secrets/cluster-secret-store.yaml" > "${render_dir}/cluster-secret-store.yaml"
kubectl apply -f "${render_dir}/cluster-issuer.yaml"
kubectl apply -f "${render_dir}/cluster-secret-store.yaml"
log "Applied ${ENVIRONMENT}. Argo CD host is argocd.${DOMAIN_NAME} once DNS is delegated."
