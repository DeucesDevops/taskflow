variable "domain_name" {
  type        = string
  description = "Public domain. Example only in tfvars: example.com."
}

variable "subscription_id" {
  type        = string
  description = "Azure subscription ID for external-dns and cert-manager."
}

variable "tenant_id" {
  type        = string
  description = "Entra tenant ID."
}

variable "dns_resource_group_name" {
  type        = string
  description = "Resource group that holds the Azure DNS zone."
}

variable "external_dns_client_id" {
  type        = string
  description = "Workload identity client ID for external-dns."
}

variable "external_secrets_client_id" {
  type        = string
  description = "Workload identity client ID for external-secrets."
}

variable "cert_manager_client_id" {
  type        = string
  description = "Workload identity client ID for cert-manager."
}

variable "ingress_replicas" {
  type        = number
  description = "ingress-nginx controller replicas."
  default     = 2
}

variable "prometheus_retention" {
  type        = string
  description = "Prometheus retention."
  default     = "15d"
}

variable "prometheus_storage_size" {
  type        = string
  description = "Prometheus PVC size."
  default     = "50Gi"
}

variable "rabbitmq_username" {
  type        = string
  description = "RabbitMQ account name. Matches the Compose user. This is not a password."
  default     = "taskflow"
}

variable "rabbitmq_storage_size" {
  type        = string
  description = "RabbitMQ PVC size."
  default     = "8Gi"
}

variable "ingress_nginx_chart_version" {
  type        = string
  description = "ingress-nginx chart version."
  default     = "4.12.1"
}

variable "cert_manager_chart_version" {
  type        = string
  description = "cert-manager chart version."
  default     = "v1.17.2"
}

variable "external_dns_chart_version" {
  type        = string
  description = "external-dns chart version."
  default     = "1.15.2"
}

variable "argocd_chart_version" {
  type        = string
  description = "Argo CD chart version."
  default     = "7.8.2"
}

variable "external_secrets_chart_version" {
  type        = string
  description = "external-secrets chart version."
  default     = "0.14.3"
}

variable "kube_prometheus_stack_chart_version" {
  type        = string
  description = "kube-prometheus-stack chart version."
  default     = "69.8.2"
}

variable "rabbitmq_chart_version" {
  type        = string
  description = "Bitnami RabbitMQ chart version."
  default     = "15.5.2"
}
