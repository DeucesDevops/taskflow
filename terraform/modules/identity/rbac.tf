resource "azurerm_role_assignment" "github_contributor" {
  scope                            = var.resource_group_id
  role_definition_name             = "Contributor"
  principal_id                     = azurerm_user_assigned_identity.github.principal_id
  skip_service_principal_aad_check = true
}

resource "azurerm_role_assignment" "github_acr_push" {
  scope                            = var.registry_id
  role_definition_name             = "AcrPush"
  principal_id                     = azurerm_user_assigned_identity.github.principal_id
  skip_service_principal_aad_check = true
}

resource "azurerm_role_assignment" "github_key_vault" {
  scope                            = azurerm_key_vault.this.id
  role_definition_name             = "Key Vault Secrets Officer"
  principal_id                     = azurerm_user_assigned_identity.github.principal_id
  skip_service_principal_aad_check = true
}

resource "azurerm_role_assignment" "github_tfstate" {
  count = var.tfstate_storage_account_id == null ? 0 : 1

  scope                            = var.tfstate_storage_account_id
  role_definition_name             = "Storage Blob Data Contributor"
  principal_id                     = azurerm_user_assigned_identity.github.principal_id
  skip_service_principal_aad_check = true
}

resource "azurerm_role_assignment" "external_dns_zone" {
  scope                            = var.dns_zone_id
  role_definition_name             = "DNS Zone Contributor"
  principal_id                     = azurerm_user_assigned_identity.platform["external-dns"].principal_id
  skip_service_principal_aad_check = true
}

resource "azurerm_role_assignment" "cert_manager_zone" {
  scope                            = var.dns_zone_id
  role_definition_name             = "DNS Zone Contributor"
  principal_id                     = azurerm_user_assigned_identity.platform["cert-manager"].principal_id
  skip_service_principal_aad_check = true
}

resource "azurerm_role_assignment" "external_secrets_vault" {
  scope                            = azurerm_key_vault.this.id
  role_definition_name             = "Key Vault Secrets User"
  principal_id                     = azurerm_user_assigned_identity.platform["external-secrets"].principal_id
  skip_service_principal_aad_check = true
}

resource "azurerm_role_assignment" "taskflow_vault" {
  scope                            = azurerm_key_vault.this.id
  role_definition_name             = "Key Vault Secrets User"
  principal_id                     = azurerm_user_assigned_identity.taskflow.principal_id
  skip_service_principal_aad_check = true
}

resource "azurerm_role_assignment" "key_vault_csi" {
  count = var.key_vault_secrets_provider_object_id == null ? 0 : 1

  scope                            = azurerm_key_vault.this.id
  role_definition_name             = "Key Vault Secrets User"
  principal_id                     = var.key_vault_secrets_provider_object_id
  skip_service_principal_aad_check = true
}
