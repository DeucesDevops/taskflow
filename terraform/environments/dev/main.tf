resource "azurerm_resource_group" "this" {
  name     = local.names.resource_group
  location = var.location
  tags     = local.tags
}

module "network" {
  source                         = "../../modules/network"
  name                           = local.names.virtual_network
  location                       = var.location
  resource_group_name            = azurerm_resource_group.this.name
  address_space                  = var.address_space
  nodes_subnet_prefix            = var.nodes_subnet_prefix
  pods_subnet_prefix             = var.pods_subnet_prefix
  ingress_subnet_prefix          = var.ingress_subnet_prefix
  postgres_subnet_prefix         = var.postgres_subnet_prefix
  private_endpoint_subnet_prefix = var.private_endpoint_subnet_prefix
  tags                           = local.tags
}

module "cluster" {
  source                          = "../../modules/cluster"
  name                            = local.names.cluster
  dns_prefix                      = local.names.cluster
  location                        = var.location
  resource_group_name             = azurerm_resource_group.this.name
  resource_group_id               = azurerm_resource_group.this.id
  nodes_subnet_id                 = module.network.nodes_subnet_id
  pods_subnet_id                  = module.network.pods_subnet_id
  kubernetes_version              = var.kubernetes_version
  sku_tier                        = var.sku_tier
  automatic_upgrade_channel       = var.automatic_upgrade_channel
  system_vm_size                  = var.system_vm_size
  system_min_count                = var.system_min_count
  system_max_count                = var.system_max_count
  user_vm_size                    = var.user_vm_size
  user_min_count                  = var.user_min_count
  user_max_count                  = var.user_max_count
  zones                           = var.zones
  service_cidr                    = var.service_cidr
  dns_service_ip                  = var.dns_service_ip
  admin_group_object_ids          = var.admin_group_object_ids
  api_server_authorized_ip_ranges = var.api_server_authorized_ip_ranges
  log_analytics_retention_days    = var.log_analytics_retention_days
  tags                            = local.tags
}

module "registry" {
  source              = "../../modules/registry"
  name                = local.names.registry
  location            = var.location
  resource_group_name = azurerm_resource_group.this.name
  sku                 = var.registry_sku
  kubelet_object_id   = module.cluster.kubelet_identity.object_id
  tags                = local.tags
}

module "dns" {
  source              = "../../modules/dns"
  zone_name           = var.domain_name
  resource_group_name = azurerm_resource_group.this.name
  tags                = local.tags
}

module "storage" {
  source              = "../../modules/storage"
  name                = local.names.storage
  location            = var.location
  resource_group_name = azurerm_resource_group.this.name
  replication_type    = var.storage_replication_type
  tags                = local.tags
}

module "postgres" {
  count  = var.enable_managed_postgres && var.postgres_administrator_password != null ? 1 : 0
  source = "../../modules/postgres"

  name                   = local.names.postgres
  location               = var.location
  resource_group_name    = azurerm_resource_group.this.name
  delegated_subnet_id    = module.network.postgres_subnet_id
  virtual_network_id     = module.network.virtual_network_id
  administrator_login    = var.postgres_administrator_login
  administrator_password = var.postgres_administrator_password
  server_version         = var.postgres_version
  sku_name               = var.postgres_sku_name
  storage_mb             = var.postgres_storage_mb
  backup_retention_days  = var.postgres_backup_retention_days
  high_availability      = var.postgres_high_availability
  tags                   = local.tags
}

module "redis" {
  count  = var.enable_managed_redis ? 1 : 0
  source = "../../modules/redis"

  name                       = local.names.redis
  location                   = var.location
  resource_group_name        = azurerm_resource_group.this.name
  virtual_network_id         = module.network.virtual_network_id
  private_endpoint_subnet_id = module.network.private_endpoint_subnet_id
  sku_name                   = var.redis_sku_name
  family                     = var.redis_family
  capacity                   = var.redis_capacity
  tags                       = local.tags
}

module "identity" {
  source                               = "../../modules/identity"
  environment                          = var.environment
  location                             = var.location
  resource_group_name                  = azurerm_resource_group.this.name
  resource_group_id                    = azurerm_resource_group.this.id
  tenant_id                            = var.tenant_id
  key_vault_name                       = local.names.key_vault
  soft_delete_retention_days           = var.key_vault_soft_delete_retention_days
  key_vault_ip_rules                   = var.key_vault_ip_rules
  virtual_network_id                   = module.network.virtual_network_id
  private_endpoint_subnet_id           = module.network.private_endpoint_subnet_id
  oidc_issuer_url                      = module.cluster.oidc_issuer_url
  github_repository                    = var.github_repository
  registry_id                          = module.registry.id
  dns_zone_id                          = module.dns.id
  tfstate_storage_account_id           = var.tfstate_storage_account_id
  key_vault_secrets_provider_object_id = module.cluster.key_vault_secrets_provider_object_id
  tags                                 = local.tags
}

module "platform" {
  source                     = "../../modules/platform"
  domain_name                = var.domain_name
  subscription_id            = var.subscription_id
  tenant_id                  = var.tenant_id
  dns_resource_group_name    = azurerm_resource_group.this.name
  external_dns_client_id     = module.identity.external_dns_client_id
  external_secrets_client_id = module.identity.external_secrets_client_id
  cert_manager_client_id     = module.identity.cert_manager_client_id
  ingress_replicas           = var.ingress_replicas
  prometheus_retention       = var.prometheus_retention
  prometheus_storage_size    = var.prometheus_storage_size
  rabbitmq_storage_size      = var.rabbitmq_storage_size
}

resource "terraform_data" "postgres_password_required" {
  lifecycle {
    precondition {
      condition     = !var.enable_managed_postgres || (var.postgres_administrator_password != null && length(var.postgres_administrator_password) >= 16)
      error_message = "Set TF_VAR_postgres_administrator_password to at least 16 URL-safe characters when enable_managed_postgres is true. Do not commit it."
    }
  }
}
