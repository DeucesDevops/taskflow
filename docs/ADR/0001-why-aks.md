# ADR 0001: AKS instead of kOps

## Status

Accepted

## Context

TaskFlow previously sketched an AWS platform around kOps. That sketch was removed. The cluster has to run five containers, a private network, workload identity, and GitOps. The operator account is Azure.

## Decision

The cluster is Azure Kubernetes Service in `terraform/modules/cluster`. There is no `kops/` directory. AKS owns the control plane, etcd, and node images. Terraform owns the VNet, NAT gateway, node pools, and add-ons.

OIDC issuer and workload identity replace kOps instance IAM. Entra ID RBAC is on and local accounts are off, so kubectl uses `kubelogin`.

## Consequences

Upgrades follow the AKS `patch` channel. The system pool is reserved for critical add-ons. Application pods land on the user pool. Leaving kOps means the cluster is not portable to raw EC2, which is acceptable because the target is Azure.
