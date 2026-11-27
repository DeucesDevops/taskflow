locals {
  prefix  = "${var.name_prefix}-${var.environment}"
  compact = replace(local.prefix, "-", "")

  names = {
    resource_group  = "rg-${local.prefix}"
    virtual_network = "vnet-${local.prefix}"
    cluster         = "aks-${local.prefix}"
    key_vault       = "kv-${local.prefix}"
    storage         = "st${local.compact}"
    registry        = "acr${local.compact}"
    redis           = "redis-${local.prefix}"
    postgres        = "psql-${local.prefix}"
  }

  tags = {
    application = "taskflow"
    environment = var.environment
    managed_by  = "terraform"
  }
}
