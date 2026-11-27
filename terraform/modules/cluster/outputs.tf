output "id" {
  description = "AKS cluster resource ID."
  value       = azurerm_kubernetes_cluster.this.id
}

output "name" {
  description = "AKS cluster name."
  value       = azurerm_kubernetes_cluster.this.name
}

output "oidc_issuer_url" {
  description = "OIDC issuer URL used for workload-identity federated credentials."
  value       = azurerm_kubernetes_cluster.this.oidc_issuer_url
}

output "kubelet_identity" {
  description = "Kubelet managed identity (client_id, object_id, user_assigned_identity_id)."
  value = {
    client_id                 = azurerm_kubernetes_cluster.this.kubelet_identity[0].client_id
    object_id                 = azurerm_kubernetes_cluster.this.kubelet_identity[0].object_id
    user_assigned_identity_id = azurerm_kubernetes_cluster.this.kubelet_identity[0].user_assigned_identity_id
  }
}

output "kube_config" {
  description = "Admin kubeconfig. Local accounts are disabled; use kubelogin with Entra ID."
  value       = azurerm_kubernetes_cluster.this.kube_config_raw
  sensitive   = true
}

output "host" {
  description = "Kubernetes API host."
  value       = azurerm_kubernetes_cluster.this.kube_config[0].host
  sensitive   = true
}

output "cluster_ca_certificate" {
  description = "Base64 cluster CA certificate."
  value       = azurerm_kubernetes_cluster.this.kube_config[0].cluster_ca_certificate
  sensitive   = true
}

output "node_resource_group" {
  description = "MC_ resource group created for the cluster."
  value       = azurerm_kubernetes_cluster.this.node_resource_group
}

output "control_plane_principal_id" {
  description = "Object ID of the user-assigned control-plane identity."
  value       = azurerm_user_assigned_identity.control_plane.principal_id
}

output "key_vault_secrets_provider_object_id" {
  description = "Object ID of the Key Vault CSI identity."
  value       = azurerm_kubernetes_cluster.this.key_vault_secrets_provider[0].secret_identity[0].object_id
}

output "log_analytics_workspace_id" {
  description = "Container Insights workspace ID."
  value       = azurerm_log_analytics_workspace.container_insights.id
}
