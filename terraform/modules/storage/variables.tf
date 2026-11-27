variable "name" {
  type        = string
  description = "Backup storage account name. Lowercase letters and digits only."

  validation {
    condition     = can(regex("^[a-z0-9]{3,24}$", var.name))
    error_message = "Storage account names must be 3-24 lowercase letters and digits."
  }
}

variable "location" {
  type        = string
  description = "Azure region."
  default     = "uksouth"
}

variable "resource_group_name" {
  type        = string
  description = "Resource group for backup storage."
}

variable "replication_type" {
  type        = string
  description = "Storage replication. Use GRS in production and LRS in dev."
  default     = "GRS"
}

variable "network_ip_rules" {
  type        = list(string)
  description = "IPv4 CIDRs allowed to reach the backup data plane. The firewall default is Deny."
  default     = []
}

variable "containers" {
  type        = set(string)
  description = "Blob containers for logical backups."
  default     = ["postgres", "redis", "rabbitmq"]
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to the storage account."
  default     = {}
}
