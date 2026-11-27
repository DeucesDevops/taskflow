resource "azurerm_user_assigned_identity" "control_plane" {
  name                = "${var.name}-control-plane"
  location            = var.location
  resource_group_name = var.resource_group_name
  tags                = var.tags
}

resource "azurerm_role_assignment" "control_plane_network" {
  scope                            = var.resource_group_id
  role_definition_name             = "Network Contributor"
  principal_id                     = azurerm_user_assigned_identity.control_plane.principal_id
  skip_service_principal_aad_check = true
}

resource "azurerm_kubernetes_cluster" "this" {
  name                              = var.name
  location                          = var.location
  resource_group_name               = var.resource_group_name
  dns_prefix                        = var.dns_prefix
  kubernetes_version                = var.kubernetes_version
  sku_tier                          = var.sku_tier
  automatic_upgrade_channel         = var.automatic_upgrade_channel == "none" ? null : var.automatic_upgrade_channel
  oidc_issuer_enabled               = true
  workload_identity_enabled         = true
  azure_policy_enabled              = true
  local_account_disabled            = true
  role_based_access_control_enabled = true
  image_cleaner_enabled             = true
  image_cleaner_interval_hours      = 168
  tags                              = var.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.control_plane.id]
  }

  azure_active_directory_role_based_access_control {
    azure_rbac_enabled     = true
    tenant_id              = data.azurerm_client_config.current.tenant_id
    admin_group_object_ids = var.admin_group_object_ids
  }

  api_server_access_profile {
    authorized_ip_ranges = var.api_server_authorized_ip_ranges
  }

  default_node_pool {
    name                         = "system"
    temporary_name_for_rotation  = "systemtemp"
    vm_size                      = var.system_vm_size
    vnet_subnet_id               = var.nodes_subnet_id
    pod_subnet_id                = var.pods_subnet_id
    os_sku                       = "Ubuntu"
    os_disk_size_gb              = 64
    type                         = "VirtualMachineScaleSets"
    zones                        = var.zones
    auto_scaling_enabled         = true
    min_count                    = var.system_min_count
    max_count                    = var.system_max_count
    only_critical_addons_enabled = true

    upgrade_settings {
      max_surge = "10%"
    }

    node_labels = {
      "taskflow.io/pool" = "system"
    }
  }

  network_profile {
    network_plugin    = "azure"
    network_policy    = "azure"
    load_balancer_sku = "standard"
    outbound_type     = "userAssignedNATGateway"
    service_cidr      = var.service_cidr
    dns_service_ip    = var.dns_service_ip

    nat_gateway_profile {
      idle_timeout_in_minutes = 4
    }
  }

  # Key Vault CSI driver. Log Analytics for Container Insights is in addons.tf.
  key_vault_secrets_provider {
    secret_rotation_enabled  = true
    secret_rotation_interval = "2m"
  }

  # Container Insights. The Log Analytics workspace is created in addons.tf.
  oms_agent {
    log_analytics_workspace_id      = azurerm_log_analytics_workspace.container_insights.id
    msi_auth_for_monitoring_enabled = true
  }

  depends_on = [
    azurerm_role_assignment.control_plane_network,
    azurerm_log_analytics_solution.container_insights,
  ]

  lifecycle {
    ignore_changes = [
      default_node_pool[0].node_count,
    ]
  }
}

data "azurerm_client_config" "current" {}
