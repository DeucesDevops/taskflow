# State lock

The `azurerm` backend locks state with a blob lease on `tfstate/<environment>.tfstate`. A failed apply can leave the lease behind.

```sh
az storage blob lease break \
  --account-name <state-account> \
  --container-name tfstate \
  --blob-name production.tfstate \
  --auth-mode login
```

Only break a lease after confirming no other apply is running. Do not disable locking. Shared keys are off, so the command uses Entra ID.
