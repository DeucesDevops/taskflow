variable "name" {
  type        = string
  description = "AKS cluster name, for example aks-taskflow-prod."
}

variable "dns_prefix" {
  type        = string
  description = "DNS prefix for the managed cluster API."
}

variable "location" {
  type        = string
  description = "Azure region."
  default     = "uksouth"
}

variable "resource_group_name" {
  type        = string
  description = "Resource group for the cluster."
}

variable "resource_group_id" {
  type        = string
  description = "Resource group ID. The control-plane identity gets Network Contributor here."
}

variable "nodes_subnet_id" {
  type        = string
  description = "aks-nodes subnet ID."
}

variable "pods_subnet_id" {
  type        = string
  description = "aks-pods subnet ID."
}

variable "kubernetes_version" {
  type        = string
  description = "AKS Kubernetes version. Null uses the current AKS default."
  default     = null
}

variable "sku_tier" {
  type        = string
  description = "AKS SKU tier: Free, Standard, or Premium."
  default     = "Standard"
}

variable "automatic_upgrade_channel" {
  type        = string
  description = "AKS automatic upgrade channel. Use patch, stable, rapid, node-image, or none."
  default     = "patch"
}

variable "system_vm_size" {
  type        = string
  description = "VM size for the system node pool."
  default     = "Standard_D4s_v5"
}

variable "system_min_count" {
  type        = number
  description = "Minimum system nodes."
  default     = 2
}

variable "system_max_count" {
  type        = number
  description = "Maximum system nodes."
  default     = 4
}

variable "user_vm_size" {
  type        = string
  description = "VM size for the user node pool."
  default     = "Standard_D4s_v5"
}

variable "user_min_count" {
  type        = number
  description = "Minimum user nodes."
  default     = 2
}

variable "user_max_count" {
  type        = number
  description = "Maximum user nodes."
  default     = 6
}

variable "zones" {
  type        = list(string)
  description = "Availability zones for both node pools."
  default     = ["1", "2", "3"]
}

variable "service_cidr" {
  type        = string
  description = "Kubernetes service CIDR. Must not overlap the VNet."
  default     = "10.32.0.0/16"
}

variable "dns_service_ip" {
  type        = string
  description = "Cluster DNS IP inside service_cidr."
  default     = "10.32.0.10"
}

variable "api_server_authorized_ip_ranges" {
  type        = list(string)
  description = "CIDRs allowed to reach the AKS API. Do not include 0.0.0.0/0."
  default     = ["203.0.113.10/32"]
}

variable "admin_group_object_ids" {
  type        = list(string)
  description = "Entra group object IDs that receive Azure RBAC cluster admin."
  default     = []
}

variable "log_analytics_retention_days" {
  type        = number
  description = "Container Insights workspace retention."
  default     = 30
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to cluster resources."
  default     = {}
}
