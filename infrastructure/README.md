# AWS foundation

Status: folder scaffold; implementation pending.

Terraform will own the shared VPC, subnets, routes, egress, ECR, private state storage and agreed IAM integrations. kOps will own cluster compute and lifecycle. The application ALB belongs to AWS Load Balancer Controller.

Next: record the environment decisions before adding Terraform configuration. Use bootstrap/, modules/ and separate environments/dev/, staging/ and production/ roots.

See [the AWS plan](../docs/plans/aws/README.md) and [resource ownership](../docs/plans/repository-structure.md#resource-ownership).
