# Terraform state bootstrap

Creates the Azure foundation for remote state:

- Resource group `rg-taskflow-tfstate` (`main.tf`)
- Storage account and private blob container (`storage.tf`)
- Subscription and tenant variables, plus resource provider registrations (`subscription.tf`)

State locking uses the Azure blob lease that the `azurerm` backend takes on the state blob. Shared keys are disabled. Configure backends with `use_oidc = true` and `use_azuread_auth = true`.

Run `scripts/bootstrap-state.sh` after `az login`. The subscription and tenant come from `TF_VAR_subscription_id` and `TF_VAR_tenant_id`. Do not write those values into a committed file. Bootstrap state stays on the operator machine (this root has no remote backend of its own) and is gitignored.

Copy `backend_hcl` from the outputs into `terraform/environments/<name>/backend.hcl` and set `key` to `dev.tfstate` or `production.tfstate`.
