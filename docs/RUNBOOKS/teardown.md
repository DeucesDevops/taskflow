# Teardown

```sh
TEARDOWN_CONFIRM=destroy-dev ./scripts/teardown-environment.sh dev
```

This destroys the environment resource group contents through Terraform. It does not delete `rg-taskflow-tfstate`. Key Vault purge protection blocks immediate name reuse. Empty the vault and wait for the retention window before reusing `kv-taskflow-dev` or `kv-taskflow-prod`.

Production uses the same script with `TEARDOWN_CONFIRM=destroy-production`.
