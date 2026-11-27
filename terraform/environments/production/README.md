# Production

Thin root for `rg-taskflow-prod`. It calls the network, cluster, registry, DNS, storage, identity, platform, and optional Postgres and Redis modules.

```sh
cp backend.hcl.example backend.hcl
cp terraform.tfvars.example terraform.tfvars
# Edit the domain and the placeholder subscription. Do not commit either file.
export TF_VAR_postgres_administrator_password
../../scripts/apply-environment.sh production plan
APPLY_CONFIRM=apply ../../scripts/apply-environment.sh production apply
```

Names follow `naming.tf`: `rg-`, `vnet-`, `aks-`, `kv-`, `st` with no dashes, and `acr` with no dashes. The default region is `uksouth`. The domain is `domain_name`; `example.com` in the example tfvars is not a real zone.

`providers.tf` configures azurerm with OIDC and wires the Kubernetes and Helm providers to the AKS host and cluster CA. Authentication is `kubelogin` against Entra ID, because local accounts are disabled.

Apply is two-stage. See `scripts/apply-environment.sh`.
