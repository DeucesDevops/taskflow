variable "name" {
  type        = string
  description = "ACR name. Alphanumeric only, for example acrtaskflowprod."

  validation {
    condition     = can(regex("^[a-zA-Z0-9]{5,50}$", var.name))
    error_message = "ACR names are 5-50 alphanumeric characters and cannot contain dashes."
  }
}

variable "location" {
  type        = string
  description = "Azure region."
  default     = "uksouth"
}

variable "resource_group_name" {
  type        = string
  description = "Resource group for the registry."
}

variable "sku" {
  type        = string
  description = "ACR SKU: Basic, Standard, or Premium."
  default     = "Premium"
}

variable "kubelet_object_id" {
  type        = string
  description = "Object ID of the AKS kubelet identity that should pull images."
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to the registry."
  default     = {}
}
