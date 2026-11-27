provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy    = false
      recover_soft_deleted_key_vaults = true
    }
    resource_group {
      prevent_deletion_if_contains_resources = true
    }
  }

  subscription_id                 = var.subscription_id
  tenant_id                       = var.tenant_id
  use_oidc                        = true
  storage_use_azuread             = true
  resource_provider_registrations = "core"
  resource_providers_to_register = [
    "Microsoft.Cache",
    "Microsoft.ContainerRegistry",
    "Microsoft.ContainerService",
    "Microsoft.DBforPostgreSQL",
    "Microsoft.Insights",
    "Microsoft.KeyVault",
    "Microsoft.ManagedIdentity",
    "Microsoft.OperationalInsights",
    "Microsoft.OperationsManagement",
    "Microsoft.PolicyInsights",
  ]
}

provider "kubernetes" {
  host                   = module.cluster.host
  cluster_ca_certificate = base64decode(module.cluster.cluster_ca_certificate)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "kubelogin"
    args = [
      "get-token",
      "--environment",
      "AzurePublicCloud",
      "--server-id",
      "6dae42f8-4368-4678-94ff-3960e28e3630",
      "--login",
      "azurecli",
    ]
  }
}

provider "helm" {
  kubernetes {
    host                   = module.cluster.host
    cluster_ca_certificate = base64decode(module.cluster.cluster_ca_certificate)

    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "kubelogin"
      args = [
        "get-token",
        "--environment",
        "AzurePublicCloud",
        "--server-id",
        "6dae42f8-4368-4678-94ff-3960e28e3630",
        "--login",
        "azurecli",
      ]
    }
  }
}
