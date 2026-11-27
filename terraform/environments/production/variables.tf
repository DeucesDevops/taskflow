variable "environment" {
  type        = string
  description = "Environment name used in resource names."
  default     = "production"

  validation {
    condition     = contains(["dev", "production"], var.environment)
    error_message = "environment must be dev or production."
  }
}

variable "location" {
  type        = string
  description = "Azure region."
  default     = "uksouth"
}

variable "name_prefix" {
  type        = string
  description = "Short name prefix. Storage and ACR names drop the dashes."
  default     = "taskflow"
}

variable "domain_name" {
  type        = string
  description = "Public DNS zone. Set the real domain at apply time. example.com is an example only."

  validation {
    condition     = can(regex("^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$", var.domain_name))
    error_message = "domain_name must look like example.com."
  }
}

variable "subscription_id" {
  type        = string
  description = "Azure subscription ID. Do not commit a real value."

  validation {
    condition     = can(regex("^[0-9a-fA-F-]{36}$", var.subscription_id))
    error_message = "subscription_id must be a GUID."
  }
}

variable "tenant_id" {
  type        = string
  description = "Entra tenant ID. Do not commit a real value."

  validation {
    condition     = can(regex("^[0-9a-fA-F-]{36}$", var.tenant_id))
    error_message = "tenant_id must be a GUID."
  }
}

variable "github_repository" {
  type        = string
  description = "GitHub org/name for Actions federated credentials."
  default     = "DeucesDevops/taskflow"
}

variable "address_space" {
  type        = list(string)
  description = "VNet address space."
  default     = ["10.20.0.0/16"]
}

variable "nodes_subnet_prefix" {
  type    = string
  default = "10.20.0.0/22"
}

variable "pods_subnet_prefix" {
  type    = string
  default = "10.20.4.0/20"
}

variable "ingress_subnet_prefix" {
  type    = string
  default = "10.20.24.0/24"
}

variable "postgres_subnet_prefix" {
  type    = string
  default = "10.20.25.0/24"
}

variable "private_endpoint_subnet_prefix" {
  type    = string
  default = "10.20.26.0/24"
}

variable "kubernetes_version" {
  type        = string
  description = "AKS version. Null selects the current AKS default."
  default     = null
}

variable "sku_tier" {
  type    = string
  default = "Standard"
}

variable "automatic_upgrade_channel" {
  type    = string
  default = "patch"
}

variable "system_vm_size" {
  type    = string
  default = "Standard_D4s_v5"
}

variable "system_min_count" {
  type    = number
  default = 2
}

variable "system_max_count" {
  type    = number
  default = 4
}

variable "user_vm_size" {
  type    = string
  default = "Standard_D4s_v5"
}

variable "user_min_count" {
  type    = number
  default = 2
}

variable "user_max_count" {
  type    = number
  default = 6
}

variable "zones" {
  type    = list(string)
  default = ["1", "2", "3"]
}

variable "service_cidr" {
  type    = string
  default = "10.32.0.0/16"
}

variable "dns_service_ip" {
  type    = string
  default = "10.32.0.10"
}

variable "api_server_authorized_ip_ranges" {
  type        = list(string)
  description = "CIDRs allowed to reach the AKS API. 203.0.113.10/32 is documentation-only (RFC 5737). Replace it before apply."
  default     = ["203.0.113.10/32"]
}

variable "admin_group_object_ids" {
  type        = list(string)
  description = "Entra groups granted AKS Azure RBAC admin."
  default     = []
}

variable "log_analytics_retention_days" {
  type    = number
  default = 90
}

variable "registry_sku" {
  type    = string
  default = "Premium"
}

variable "storage_replication_type" {
  type    = string
  default = "GRS"
}

variable "enable_managed_postgres" {
  type        = bool
  description = "Create Azure Database for PostgreSQL Flexible Server."
  default     = true
}

variable "enable_managed_redis" {
  type        = bool
  description = "Create Azure Cache for Redis."
  default     = true
}

variable "postgres_administrator_login" {
  type    = string
  default = "taskflow"
}

variable "postgres_administrator_password" {
  type        = string
  description = "Flexible Server password. Set TF_VAR_postgres_administrator_password. Never commit it."
  sensitive   = true
  default     = null
  nullable    = true
}

variable "postgres_version" {
  type        = string
  description = "PostgreSQL major version. Local Compose uses 17."
  default     = "17"
}

variable "postgres_sku_name" {
  type    = string
  default = "GP_Standard_D2s_v3"
}

variable "postgres_storage_mb" {
  type    = number
  default = 131072
}

variable "postgres_backup_retention_days" {
  type    = number
  default = 14
}

variable "postgres_high_availability" {
  type    = bool
  default = true
}

variable "redis_sku_name" {
  type    = string
  default = "Standard"
}

variable "redis_family" {
  type    = string
  default = "C"
}

variable "redis_capacity" {
  type    = number
  default = 1
}

variable "key_vault_soft_delete_retention_days" {
  type    = number
  default = 90
}

variable "key_vault_ip_rules" {
  type        = list(string)
  description = "Optional Key Vault firewall allow list. Secret values are still not stored in files."
  default     = []
}

variable "tfstate_storage_account_id" {
  type        = string
  description = "Bootstrap state account ID so GitHub Actions can use the blob backend. Null skips the role."
  default     = null
}

variable "ingress_replicas" {
  type    = number
  default = 2
}

variable "prometheus_retention" {
  type    = string
  default = "15d"
}

variable "prometheus_storage_size" {
  type    = string
  default = "50Gi"
}

variable "rabbitmq_storage_size" {
  type    = string
  default = "16Gi"
}
