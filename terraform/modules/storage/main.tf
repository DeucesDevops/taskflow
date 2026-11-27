resource "azurerm_storage_account" "backups" {
  name                            = var.name
  resource_group_name             = var.resource_group_name
  location                        = var.location
  account_tier                    = "Standard"
  account_replication_type        = var.replication_type
  account_kind                    = "StorageV2"
  min_tls_version                 = "TLS1_2"
  https_traffic_only_enabled      = true
  allow_nested_items_to_be_public = false
  shared_access_key_enabled       = false
  public_network_access_enabled   = true
  tags                            = var.tags

  network_rules {
    default_action = "Deny"
    bypass         = ["AzureServices"]
    ip_rules       = var.network_ip_rules
  }

  blob_properties {
    versioning_enabled = true

    delete_retention_policy {
      days = 30
    }

    container_delete_retention_policy {
      days = 30
    }
  }
}

resource "azurerm_storage_container" "backups" {
  for_each = var.containers

  name                  = each.value
  storage_account_id    = azurerm_storage_account.backups.id
  container_access_type = "private"
}
