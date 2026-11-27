# ADR 0002: AWS concepts on Azure

## Status

Accepted

## Context

Earlier notes described the platform with AWS names: VPC, EKS, kOps, ECR, IRSA, Route 53, ACM, S3, and DynamoDB locks. The implementation target is Azure.

## Decision

| Earlier AWS idea | Azure implementation |
| --- | --- |
| VPC, subnets, NAT, route tables | VNet, `aks-nodes`, `aks-pods`, `ingress`, NAT gateway, route tables, NSGs |
| EKS or kOps | AKS. No kOps. |
| ECR | ACR, `AcrPull` for the kubelet, `AcrPush` for GitHub |
| IRSA | User-assigned identities and federated credentials |
| GitHub OIDC to AWS | Federated credential, `azure/login`, no client secret |
| S3 remote state and DynamoDB lock | Blob container and the backend blob lease |
| Route 53 | Azure DNS |
| ACM | cert-manager, Let's Encrypt, DNS-01 |
| ALB | ingress-nginx Service of type LoadBalancer |
| RDS | Optional PostgreSQL Flexible Server |
| ElastiCache | Optional Azure Cache for Redis |
| Amazon MQ | RabbitMQ Helm release in the cluster |
| CloudWatch | Container Insights, Log Analytics, kube-prometheus-stack |
| KMS | Key Vault with RBAC and a private endpoint |
| IAM roles for service accounts | Workload identity labels on the service accounts |

## Consequences

Names in `naming.tf` follow `rg-`, `vnet-`, `aks-`, `kv-`, `st` without dashes, and `acr` without dashes. People reading the old AWS notes should use this table rather than looking for a `kops/` tree.
