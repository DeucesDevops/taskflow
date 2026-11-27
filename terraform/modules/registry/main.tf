resource "azurerm_container_registry" "this" {
  name                          = var.name
  resource_group_name           = var.resource_group_name
  location                      = var.location
  sku                           = var.sku
  admin_enabled                 = false
  public_network_access_enabled = true
  zone_redundancy_enabled       = var.sku == "Premium"
  anonymous_pull_enabled        = false
  tags                          = var.tags
}

resource "azurerm_role_assignment" "kubelet_acr_pull" {
  scope                            = azurerm_container_registry.this.id
  role_definition_name             = "AcrPull"
  principal_id                     = var.kubelet_object_id
  skip_service_principal_aad_check = true
}
