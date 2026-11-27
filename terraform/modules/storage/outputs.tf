output "id" {
  description = "Backup storage account ID."
  value       = azurerm_storage_account.backups.id
}

output "name" {
  description = "Backup storage account name."
  value       = azurerm_storage_account.backups.name
}

output "container_names" {
  description = "Private blob containers for logical backups."
  value       = sort([for container in azurerm_storage_container.backups : container.name])
}
