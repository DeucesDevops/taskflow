# Network

VNet for one TaskFlow environment.

| Subnet | Purpose |
| --- | --- |
| `aks-nodes` | AKS node pools. NAT gateway for egress. Route table required by AKS. |
| `aks-pods` | Azure CNI pod IPs. Delegated to `Microsoft.ContainerService/managedClusters`. |
| `ingress` | Reserved for the ingress load balancer. NSG allows TCP 80 and 443 from the internet. |
| `postgres` | Delegated to PostgreSQL Flexible Server. |
| `private-endpoints` | Key Vault and Azure Cache for Redis private endpoints. |

The NAT gateway has one static public IP. Route tables on the node, pod, and ingress subnets do not send `0.0.0.0/0` anywhere else, so node and pod egress stays on the NAT gateway. NSGs deny other inbound internet traffic on the node and pod subnets.
