resource "azurerm_user_assigned_identity" "github" {
  name                = "id-github-${var.environment}"
  location            = var.location
  resource_group_name = var.resource_group_name
  tags                = var.tags
}

resource "azurerm_federated_identity_credential" "github" {
  for_each = toset(local.github_subjects)

  name                      = trim(replace(replace(replace(replace(each.value, ":", "-"), "/", "-"), ".", "-"), "_", "-"), "-")
  user_assigned_identity_id = azurerm_user_assigned_identity.github.id
  audience                  = ["api://AzureADTokenExchange"]
  issuer                    = "https://token.actions.githubusercontent.com"
  subject                   = each.value
}
