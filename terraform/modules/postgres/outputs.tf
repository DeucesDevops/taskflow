output "id" {
  description = "Flexible Server resource ID."
  value       = azurerm_postgresql_flexible_server.this.id
}

output "fqdn" {
  description = "Server FQDN. Application schemas are created by each service on startup."
  value       = azurerm_postgresql_flexible_server.this.fqdn
}

output "database_name" {
  description = "Database name shared by the auth, projects, and tasks schemas."
  value       = azurerm_postgresql_flexible_server_database.taskflow.name
}

output "administrator_login" {
  description = "Administrator login name."
  value       = azurerm_postgresql_flexible_server.this.administrator_login
}
