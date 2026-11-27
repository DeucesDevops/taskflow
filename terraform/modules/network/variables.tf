variable "name" {
  type        = string
  description = "Virtual network name, for example vnet-taskflow-prod."
}

variable "location" {
  type        = string
  description = "Azure region."
  default     = "uksouth"
}

variable "resource_group_name" {
  type        = string
  description = "Resource group that holds the network."
}

variable "address_space" {
  type        = list(string)
  description = "VNet address space."
  default     = ["10.20.0.0/16"]
}

variable "nodes_subnet_prefix" {
  type        = string
  description = "CIDR for the aks-nodes subnet."
  default     = "10.20.0.0/22"
}

variable "pods_subnet_prefix" {
  type        = string
  description = "CIDR for the aks-pods subnet. Azure CNI takes pod IPs from this range."
  default     = "10.20.4.0/20"
}

variable "ingress_subnet_prefix" {
  type        = string
  description = "CIDR for the ingress subnet."
  default     = "10.20.24.0/24"
}

variable "postgres_subnet_prefix" {
  type        = string
  description = "CIDR delegated to PostgreSQL Flexible Server."
  default     = "10.20.25.0/24"
}

variable "private_endpoint_subnet_prefix" {
  type        = string
  description = "CIDR for private endpoints (Redis, Key Vault)."
  default     = "10.20.26.0/24"
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to network resources."
  default     = {}
}
