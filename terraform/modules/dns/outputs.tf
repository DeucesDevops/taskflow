output "id" {
  description = "DNS zone resource ID."
  value       = azurerm_dns_zone.this.id
}

output "name" {
  description = "DNS zone name."
  value       = azurerm_dns_zone.this.name
}

output "name_servers" {
  description = "Azure DNS name servers to delegate at the registrar."
  value       = azurerm_dns_zone.this.name_servers
}
