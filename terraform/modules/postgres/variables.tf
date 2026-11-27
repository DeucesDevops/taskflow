variable "name" {
  type        = string
  description = "Flexible Server name. Globally unique, lowercase."
}

variable "location" {
  type        = string
  description = "Azure region."
  default     = "uksouth"
}

variable "resource_group_name" {
  type        = string
  description = "Resource group for the server."
}

variable "delegated_subnet_id" {
  type        = string
  description = "Subnet delegated to Microsoft.DBforPostgreSQL/flexibleServers."
}

variable "virtual_network_id" {
  type        = string
  description = "VNet that should resolve the server private DNS zone."
}

variable "administrator_login" {
  type        = string
  description = "PostgreSQL administrator role. Not a secret. Matches the local Compose user."
  default     = "taskflow"
}

variable "administrator_password" {
  type        = string
  description = "Administrator password. Set TF_VAR_postgres_administrator_password. Never commit it."
  sensitive   = true
  default     = null
  nullable    = true
}

variable "server_version" {
  type        = string
  description = "PostgreSQL major version. The local stack uses 17."
  default     = "17"
}

variable "sku_name" {
  type        = string
  description = "Flexible Server SKU."
  default     = "GP_Standard_D2s_v3"
}

variable "storage_mb" {
  type        = number
  description = "Storage size in MB."
  default     = 131072
}

variable "backup_retention_days" {
  type        = number
  description = "Backup retention in days."
  default     = 14
}

variable "high_availability" {
  type        = bool
  description = "Enable zone-redundant high availability."
  default     = true
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to the server."
  default     = {}
}
