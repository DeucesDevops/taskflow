# Identity

Entra workload identities and Key Vault for one environment. No client secrets are created.

`github_oidc.tf` is a user-assigned identity with federated credentials for GitHub Actions. The subjects cover pull requests, the `dev` branch, and the `dev` and `production` GitHub environments. `azure/login` exchanges the GitHub OIDC token for this identity. There is no client secret.

`workload_identity.tf` creates managed identities and federated credentials for:

- `external-dns` / `external-dns`
- `external-secrets` / `external-secrets`
- `cert-manager` / `cert-manager`
- `taskflow` service accounts: frontend, auth-service, project-service, task-service, notification-service

`rbac.tf` scopes role assignments to the environment resource group, the registry, the DNS zone, the state storage account, and Key Vault. GitHub receives Contributor, AcrPush, and Key Vault Secrets Officer. Controllers receive DNS Zone Contributor or Key Vault Secrets User.

`keyvault.tf` creates a purge-protected vault with RBAC authorization, a private endpoint, and a firewall that denies the data plane unless `key_vault_ip_rules` allows the caller. Pods reach the vault through the private endpoint. Secret values are not declared in this module.
