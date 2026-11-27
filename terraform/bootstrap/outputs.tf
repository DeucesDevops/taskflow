output "resource_group_name" {
  description = "State resource group. Use this as resource_group_name in backend.hcl."
  value       = azurerm_resource_group.tfstate.name
}

output "storage_account_name" {
  description = "State storage account. Use this as storage_account_name in backend.hcl."
  value       = azurerm_storage_account.tfstate.name
}

output "container_name" {
  description = "State blob container. Use this as container_name in backend.hcl."
  value       = azurerm_storage_container.tfstate.name
}

output "backend_hcl" {
  description = "Example backend.hcl body. Copy it to environments/* /backend.hcl and set key per environment. Locking is the blob lease (use_oidc)."
  value       = <<-EOT
    resource_group_name  = "${azurerm_resource_group.tfstate.name}"
    storage_account_name = "${azurerm_storage_account.tfstate.name}"
    container_name       = "${azurerm_storage_container.tfstate.name}"
    key                  = "ENVIRONMENT.tfstate"
    use_oidc             = true
    use_azuread_auth     = true
  EOT
}
