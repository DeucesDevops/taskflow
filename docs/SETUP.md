# Platform setup

Prerequisites: Azure CLI, Terraform 1.6 or newer, kubectl, kubelogin, Helm, envsubst (gettext), and Python 3. The subscription needs permission to register resource providers and create role assignments.

## State

```sh
export TF_VAR_subscription_id="<subscription-guid>"
export TF_VAR_tenant_id="<tenant-guid>"
BOOTSTRAP_CONFIRM=apply ./scripts/bootstrap-state.sh
```

`az login` must already succeed. The script creates `rg-taskflow-tfstate`, a storage account, and a private blob container. Locking is the blob lease taken by the `azurerm` backend. Copy the `backend_hcl` output to `terraform/environments/dev/backend.hcl` and `terraform/environments/production/backend.hcl`, and set `key` to `dev.tfstate` or `production.tfstate`.

Do not commit `backend.hcl`, `terraform.tfvars`, or any password.

## Environment

```sh
cd terraform/environments/dev
cp backend.hcl.example backend.hcl
cp terraform.tfvars.example terraform.tfvars
```

Change `domain_name` if `example.com` is only the example. Set `TF_VAR_postgres_administrator_password` when managed Postgres is enabled. The password must be URL-safe and at least 16 characters.

```sh
make plan ENV=dev
APPLY_CONFIRM=apply make apply ENV=dev
make kubeconfig ENV=dev
```

`make apply` is two-stage. Stage 1 creates the resource group, network, AKS, registry, DNS, backup storage, and identities. Stage 2 installs Helm releases and renders the cert-manager issuer and ClusterSecretStore. The default region is `uksouth`.

## Key Vault names

Create these secrets in the environment vault. Values stay out of git.

| Secret | Used by |
| --- | --- |
| `postgres-password` | auth, projects, tasks |
| `redis-url` | auth and notifications. Use a `rediss://` URL on port 6380. |
| `jwt-secret` | auth. At least 32 bytes. |
| `demo-password` | auth bootstrap user |

RabbitMQ's password is generated into the `rabbitmq-connection` secret in the `taskflow` namespace. It is not a Key Vault value and it is not in the repository.

## DNS

Delegate the domain to the `dns_name_servers` output. external-dns and cert-manager both use the zone.

## GitHub

Store the identity output `github_client_id` as `AZURE_CLIENT_ID`, plus `AZURE_TENANT_ID` and `AZURE_SUBSCRIPTION_ID`. These are identifiers for `azure/login`, not a client secret. For plan on pull requests, also set `TF_STATE_RESOURCE_GROUP`, `TF_STATE_STORAGE_ACCOUNT`, `TF_STATE_CONTAINER`, and optionally `TF_DOMAIN_NAME` and `ACR_LOGIN_SERVER` / `ACR_NAME`.

Protect the GitHub environment named `production` with required reviewers. That gate is what `deploy.yaml` waits on.
