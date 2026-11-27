variable "subscription_id" {
  type        = string
  description = "Azure subscription that hosts TaskFlow. Set TF_VAR_subscription_id or pass -var. Do not commit the value."

  validation {
    condition     = can(regex("^[0-9a-fA-F-]{36}$", var.subscription_id))
    error_message = "subscription_id must be a GUID."
  }
}

variable "tenant_id" {
  type        = string
  description = "Entra tenant ID. Set TF_VAR_tenant_id or pass -var. Do not commit the value."

  validation {
    condition     = can(regex("^[0-9a-fA-F-]{36}$", var.tenant_id))
    error_message = "tenant_id must be a GUID."
  }
}

# Explicit registrations so a fresh subscription can host the platform.
# The environment roots do not register providers themselves.
resource "azurerm_resource_provider_registration" "this" {
  for_each = toset([
    "Microsoft.Cache",
    "Microsoft.ContainerRegistry",
    "Microsoft.ContainerService",
    "Microsoft.DBforPostgreSQL",
    "Microsoft.Insights",
    "Microsoft.KeyVault",
    "Microsoft.ManagedIdentity",
    "Microsoft.Network",
    "Microsoft.OperationalInsights",
    "Microsoft.OperationsManagement",
    "Microsoft.PolicyInsights",
    "Microsoft.Storage",
  ])

  name = each.value
}
