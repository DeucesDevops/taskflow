output "namespaces" {
  description = "Namespaces created for platform controllers and TaskFlow."
  value       = sort(keys(kubernetes_namespace.this))
}

output "argocd_host" {
  description = "Argo CD ingress host. The domain is the environment variable, not a committed production name."
  value       = "argocd.${var.domain_name}"
}

output "rabbitmq_service" {
  description = "In-cluster RabbitMQ service used by tasks and notifications."
  value       = "rabbitmq.rabbitmq.svc.cluster.local"
}
