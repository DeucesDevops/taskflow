# Platform

Helm releases installed after AKS exists:

- ingress-nginx
- cert-manager
- external-dns (Azure DNS provider, workload identity)
- Argo CD
- external-secrets
- kube-prometheus-stack
- RabbitMQ (Bitnami chart, in-cluster)

Chart values live in `/platform` and are overlaid with the environment domain and workload-identity client IDs. Those client IDs are identifiers, not secrets.

RabbitMQ and Grafana passwords are random values stored only in Kubernetes secrets and Terraform state. They are not written to the repository. The TaskFlow namespace receives `rabbitmq-connection` / `RABBITMQ_URL` for the application chart. Copy `postgres-password`, `redis-url`, `jwt-secret`, and `demo-password` into Key Vault separately. See `docs/ADR/0003-data-services.md`.

Apply this module in the second stage, after the cluster API answers. `scripts/apply-environment.sh` does that, then renders the cert-manager issuer and the ClusterSecretStore.
