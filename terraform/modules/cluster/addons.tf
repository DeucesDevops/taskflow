# Container Insights workspace. The cluster oms_agent block in main.tf sends
# logs here. Azure Policy is azure_policy_enabled on the cluster. Key Vault
# CSI is the key_vault_secrets_provider block on the cluster.

resource "azurerm_log_analytics_workspace" "container_insights" {
  name                = "${var.name}-logs"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "PerGB2018"
  retention_in_days   = var.log_analytics_retention_days
  tags                = var.tags
}

resource "azurerm_log_analytics_solution" "container_insights" {
  solution_name         = "ContainerInsights"
  location              = var.location
  resource_group_name   = var.resource_group_name
  workspace_resource_id = azurerm_log_analytics_workspace.container_insights.id
  workspace_name        = azurerm_log_analytics_workspace.container_insights.name

  plan {
    publisher = "Microsoft"
    product   = "OMSGallery/ContainerInsights"
  }

  tags = var.tags
}

resource "azurerm_monitor_diagnostic_setting" "aks" {
  name                       = "${var.name}-diagnostics"
  target_resource_id         = azurerm_kubernetes_cluster.this.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.container_insights.id

  enabled_log {
    category_group = "allLogs"
  }

  enabled_metric {
    category = "AllMetrics"
  }
}
