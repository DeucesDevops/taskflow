# Cluster

AKS for one environment. The cluster resource is in `main.tf`:

- System node pool on `aks-nodes`, pod IPs from `aks-pods`
- Azure CNI (`network_plugin = "azure"`) and Azure network policy
- User-assigned NAT gateway for egress
- OIDC issuer and workload identity
- Entra ID RBAC with local accounts disabled
- Key Vault CSI secret rotation

`node_pools.tf` adds a user pool with autoscaling and availability zones. Application pods schedule there because the system pool is tainted for critical add-ons only.

`addons.tf` creates the Log Analytics workspace and the Container Insights solution, and sends AKS diagnostics to that workspace. Azure Policy is `azure_policy_enabled` on the cluster. Key Vault CSI is the `key_vault_secrets_provider` block.

Outputs used by the rest of the stack: kube config, API host, cluster CA, `oidc_issuer_url`, and the kubelet identity.
