variable "name" {
  type        = string
  description = "Azure Cache for Redis name. Globally unique."
}

variable "location" {
  type        = string
  description = "Azure region."
  default     = "uksouth"
}

variable "resource_group_name" {
  type        = string
  description = "Resource group for the cache."
}

variable "virtual_network_id" {
  type        = string
  description = "VNet that should resolve the Redis private DNS zone."
}

variable "private_endpoint_subnet_id" {
  type        = string
  description = "Subnet for the Redis private endpoint."
}

variable "sku_name" {
  type        = string
  description = "Redis SKU: Basic, Standard, or Premium."
  default     = "Standard"
}

variable "family" {
  type        = string
  description = "SKU family. C for Basic/Standard, P for Premium."
  default     = "C"
}

variable "capacity" {
  type        = number
  description = "Cache size. C family uses 0-6."
  default     = 1
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to the cache."
  default     = {}
}
