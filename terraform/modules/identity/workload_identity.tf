resource "azurerm_user_assigned_identity" "platform" {
  for_each = local.platform_identities

  name                = "id-${each.key}-${var.environment}"
  location            = var.location
  resource_group_name = var.resource_group_name
  tags                = var.tags
}

resource "azurerm_federated_identity_credential" "platform" {
  for_each = local.platform_identities

  name                      = each.key
  user_assigned_identity_id = azurerm_user_assigned_identity.platform[each.key].id
  audience                  = ["api://AzureADTokenExchange"]
  issuer                    = var.oidc_issuer_url
  subject                   = "system:serviceaccount:${each.value.namespace}:${each.value.service_account}"
}

resource "azurerm_user_assigned_identity" "taskflow" {
  name                = "id-taskflow-${var.environment}"
  location            = var.location
  resource_group_name = var.resource_group_name
  tags                = var.tags
}

resource "azurerm_federated_identity_credential" "taskflow" {
  for_each = local.application_service_accounts

  name                      = each.value
  user_assigned_identity_id = azurerm_user_assigned_identity.taskflow.id
  audience                  = ["api://AzureADTokenExchange"]
  issuer                    = var.oidc_issuer_url
  subject                   = "system:serviceaccount:taskflow:${each.value}"
}
