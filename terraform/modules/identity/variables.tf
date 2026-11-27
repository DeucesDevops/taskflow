variable "environment" {
  type        = string
  description = "Environment name, dev or production."
}

variable "location" {
  type        = string
  description = "Azure region."
  default     = "uksouth"
}

variable "resource_group_name" {
  type        = string
  description = "Resource group for identities and Key Vault."
}

variable "resource_group_id" {
  type        = string
  description = "Resource group ID for role assignments."
}

variable "tenant_id" {
  type        = string
  description = "Entra tenant ID."
}

variable "key_vault_name" {
  type        = string
  description = "Key Vault name, for example kv-taskflow-prod."

  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9-]{1,22}[a-zA-Z0-9]$", var.key_vault_name))
    error_message = "Key Vault names are 3-24 characters, start with a letter, and end with a letter or digit."
  }
}

variable "soft_delete_retention_days" {
  type        = number
  description = "Key Vault soft-delete retention. Minimum 7 when purge protection is on."
  default     = 90
}

variable "key_vault_ip_rules" {
  type        = list(string)
  description = "CIDR or IPs allowed through the Key Vault firewall. Empty denies data-plane access except the private endpoint and Azure services."
  default     = []
}

variable "virtual_network_id" {
  type        = string
  description = "VNet for the Key Vault private DNS link."
}

variable "private_endpoint_subnet_id" {
  type        = string
  description = "Subnet for the Key Vault private endpoint."
}

variable "oidc_issuer_url" {
  type        = string
  description = "AKS OIDC issuer URL."
}

variable "github_repository" {
  type        = string
  description = "GitHub repository in org/name form used as the federated credential subject."
  default     = "DeucesDevops/taskflow"
}

variable "registry_id" {
  type        = string
  description = "ACR resource ID for AcrPush."
}

variable "dns_zone_id" {
  type        = string
  description = "Azure DNS zone ID for external-dns and cert-manager."
}

variable "tfstate_storage_account_id" {
  type        = string
  description = "State storage account ID. Null skips the blob data role."
  default     = null
}

variable "key_vault_secrets_provider_object_id" {
  type        = string
  description = "Key Vault CSI identity object ID. Null skips that role assignment."
  default     = null
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to identity resources."
  default     = {}
}
