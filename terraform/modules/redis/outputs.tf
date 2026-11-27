output "id" {
  description = "Redis cache resource ID."
  value       = azurerm_redis_cache.this.id
}

output "hostname" {
  description = "Private hostname. The access key stays in state and must be copied into Key Vault as redis-url."
  value       = azurerm_redis_cache.this.hostname
}

output "ssl_port" {
  description = "TLS port. Clients use rediss:// on this port."
  value       = azurerm_redis_cache.this.ssl_port
}
