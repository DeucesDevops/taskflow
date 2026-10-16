# kOps cluster definitions

Status: folder scaffold; implementation pending.

Reserve cluster specifications and instance groups under environments/. Reuse Terraform-owned network and egress references. addons/ contains only addons explicitly assigned to kOps.

Next: select a compatible pinned kOps/Kubernetes pair, DNS mode, restricted API access and cluster capacity before writing cluster definitions.

See [stages 6–7](../docs/plans/implementation-plan.md#6-provision-the-kops-cluster).
