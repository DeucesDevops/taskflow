# Cluster deployment

1. `az login` and export `TF_VAR_subscription_id` and `TF_VAR_tenant_id`.
2. `BOOTSTRAP_CONFIRM=apply ./scripts/bootstrap-state.sh` once per subscription.
3. Copy `backend.hcl.example` and `terraform.tfvars.example` in the environment directory. Set the real domain. Do not commit them.
4. `make plan ENV=production`
5. `APPLY_CONFIRM=apply make apply ENV=production`
6. Delegate DNS to the `dns_name_servers` output.
7. Create the Key Vault secrets listed in [SETUP.md](../SETUP.md).
8. Confirm Argo CD is serving `argocd.<domain>` and the TaskFlow application is synced.

Stage 1 must finish before Helm runs. If stage 2 fails because the API is still provisioning, rerun `APPLY_CONFIRM=apply ./scripts/apply-environment.sh production apply`.
