output "github_client_id" {
  description = "Client ID for azure/login OIDC. Store it as the GitHub secret AZURE_CLIENT_ID."
  value       = azurerm_user_assigned_identity.github.client_id
}

output "github_principal_id" {
  description = "Object ID of the GitHub Actions identity."
  value       = azurerm_user_assigned_identity.github.principal_id
}

output "key_vault_id" {
  description = "Key Vault resource ID."
  value       = azurerm_key_vault.this.id
}

output "key_vault_uri" {
  description = "Key Vault data-plane URI."
  value       = azurerm_key_vault.this.vault_uri
}

output "key_vault_name" {
  description = "Key Vault name."
  value       = azurerm_key_vault.this.name
}

output "external_dns_client_id" {
  description = "Client ID annotated on the external-dns service account."
  value       = azurerm_user_assigned_identity.platform["external-dns"].client_id
}

output "external_secrets_client_id" {
  description = "Client ID annotated on the external-secrets service account."
  value       = azurerm_user_assigned_identity.platform["external-secrets"].client_id
}

output "cert_manager_client_id" {
  description = "Client ID annotated on the cert-manager service account."
  value       = azurerm_user_assigned_identity.platform["cert-manager"].client_id
}

output "taskflow_client_id" {
  description = "Client ID annotated on TaskFlow application service accounts."
  value       = azurerm_user_assigned_identity.taskflow.client_id
}
