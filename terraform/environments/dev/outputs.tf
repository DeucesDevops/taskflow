output "domain_name" {
  description = "Public domain configured for this environment."
  value       = var.domain_name
}

output "resource_group_name" {
  description = "Environment resource group."
  value       = azurerm_resource_group.this.name
}

output "cluster_name" {
  description = "AKS cluster name."
  value       = module.cluster.name
}

output "oidc_issuer_url" {
  description = "AKS OIDC issuer."
  value       = module.cluster.oidc_issuer_url
}

output "kube_config" {
  description = "Raw kubeconfig. Local accounts are disabled; use scripts/update-kubeconfig.sh."
  value       = module.cluster.kube_config
  sensitive   = true
}

output "registry_login_server" {
  description = "ACR login server. Put this host in helm/taskflow values when promoting images."
  value       = module.registry.login_server
}

output "dns_name_servers" {
  description = "Delegate the domain to these Azure DNS name servers."
  value       = module.dns.name_servers
}

output "key_vault_uri" {
  description = "Key Vault URI for the ClusterSecretStore."
  value       = module.identity.key_vault_uri
}

output "github_client_id" {
  description = "Federated identity client ID for GitHub Actions. Not a secret. Store as AZURE_CLIENT_ID."
  value       = module.identity.github_client_id
}

output "workload_identity_client_ids" {
  description = "Client IDs annotated onto platform and application service accounts."
  value = {
    external_dns     = module.identity.external_dns_client_id
    external_secrets = module.identity.external_secrets_client_id
    cert_manager     = module.identity.cert_manager_client_id
    taskflow         = module.identity.taskflow_client_id
  }
}

output "postgres_fqdn" {
  description = "PostgreSQL Flexible Server FQDN, when the module is enabled."
  value       = try(module.postgres[0].fqdn, null)
}

output "redis_hostname" {
  description = "Azure Cache for Redis hostname, when the module is enabled."
  value       = try(module.redis[0].hostname, null)
}

output "backup_containers" {
  description = "Private blob containers for logical backups."
  value       = module.storage.container_names
}
