resource "azurerm_resource_group" "tfstate" {
  name     = "rg-taskflow-tfstate"
  location = var.location

  tags = {
    application = "taskflow"
    purpose     = "terraform-state"
    managed_by  = "terraform"
  }
}
