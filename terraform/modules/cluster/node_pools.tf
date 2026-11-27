resource "azurerm_kubernetes_cluster_node_pool" "user" {
  name                        = "user"
  kubernetes_cluster_id       = azurerm_kubernetes_cluster.this.id
  temporary_name_for_rotation = "usertemp"
  vm_size                     = var.user_vm_size
  vnet_subnet_id              = var.nodes_subnet_id
  pod_subnet_id               = var.pods_subnet_id
  mode                        = "User"
  os_sku                      = "Ubuntu"
  os_disk_size_gb             = 64
  zones                       = var.zones
  auto_scaling_enabled        = true
  min_count                   = var.user_min_count
  max_count                   = var.user_max_count

  upgrade_settings {
    max_surge = "10%"
  }

  node_labels = {
    "taskflow.io/pool" = "user"
  }

  tags = var.tags

  lifecycle {
    ignore_changes = [node_count]
  }
}
