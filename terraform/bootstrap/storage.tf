# Remote state lives in a private blob container. The azurerm backend locks
# that blob with a lease, so this stack does not create a separate lock table.
resource "azurerm_storage_account" "tfstate" {
  name                            = var.storage_account_name
  resource_group_name             = azurerm_resource_group.tfstate.name
  location                        = azurerm_resource_group.tfstate.location
  account_tier                    = "Standard"
  account_replication_type        = "GRS"
  account_kind                    = "StorageV2"
  min_tls_version                 = "TLS1_2"
  https_traffic_only_enabled      = true
  allow_nested_items_to_be_public = false
  shared_access_key_enabled       = false
  public_network_access_enabled   = true

  network_rules {
    default_action = "Deny"
    bypass         = ["AzureServices"]
    ip_rules       = var.network_ip_rules
  }

  blob_properties {
    versioning_enabled  = true
    change_feed_enabled = true

    delete_retention_policy {
      days = 30
    }

    container_delete_retention_policy {
      days = 30
    }
  }

  sas_policy {
    expiration_period = "90.00:00:00"
    expiration_action = "Log"
  }

  tags = azurerm_resource_group.tfstate.tags

  depends_on = [azurerm_resource_provider_registration.this]
}

resource "azurerm_storage_container" "tfstate" {
  name                  = var.container_name
  storage_account_id    = azurerm_storage_account.tfstate.id
  container_access_type = "private"
}
