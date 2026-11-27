output "virtual_network_id" {
  description = "VNet resource ID."
  value       = azurerm_virtual_network.this.id
}

output "virtual_network_name" {
  description = "VNet name."
  value       = azurerm_virtual_network.this.name
}

output "nodes_subnet_id" {
  description = "aks-nodes subnet ID."
  value       = azurerm_subnet.nodes.id
}

output "pods_subnet_id" {
  description = "aks-pods subnet ID."
  value       = azurerm_subnet.pods.id
}

output "ingress_subnet_id" {
  description = "ingress subnet ID."
  value       = azurerm_subnet.ingress.id
}

output "postgres_subnet_id" {
  description = "Delegated PostgreSQL subnet ID."
  value       = azurerm_subnet.postgres.id
}

output "private_endpoint_subnet_id" {
  description = "Private endpoint subnet ID."
  value       = azurerm_subnet.private_endpoints.id
}

output "nat_gateway_id" {
  description = "NAT gateway ID associated with the node and pod subnets."
  value       = azurerm_nat_gateway.this.id
}

output "nat_public_ip" {
  description = "Static public IP used by the NAT gateway."
  value       = azurerm_public_ip.nat.ip_address
}
