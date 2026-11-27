variable "location" {
  type        = string
  description = "Azure region for the Terraform state resources."
  default     = "uksouth"
}

variable "storage_account_name" {
  type        = string
  description = "Globally unique storage account name for state. Lowercase letters and digits only."
  default     = "sttaskflowtfstate"

  validation {
    condition     = can(regex("^[a-z0-9]{3,24}$", var.storage_account_name))
    error_message = "Storage account names must be 3-24 lowercase letters and digits, with no dashes."
  }
}

variable "network_ip_rules" {
  type        = list(string)
  description = "IPv4 CIDRs allowed to reach the state data plane. The firewall default is Deny."
  default     = []
}

variable "container_name" {
  type        = string
  description = "Blob container that holds Terraform state."
  default     = "tfstate"
}
