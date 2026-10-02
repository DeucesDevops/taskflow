# TaskFlow Kubernetes manifest draft

These files model the planned **kOps on AWS** deployment; they do not create a
cluster or deploy anything by themselves. They preserve the application's
current eight-container shape:

```text
Internet → AWS ALB → NGINX Ingress Controller → frontend Service
                                               └→ frontend API proxy
                                                  → Auth / Projects / Tasks / Notifications
Auth / Projects / Tasks → PostgreSQL
Auth / Notifications → Redis
Tasks → RabbitMQ → Notifications → Redis
```

The five application containers are Deployments with private ClusterIP
Services. PostgreSQL, Redis, and RabbitMQ are single-replica StatefulSets with
separate EBS-backed PersistentVolumeClaims. Each StatefulSet has a headless
governing Service for stable pod identity and a separate ClusterIP Service for
application traffic. The public ALB terminates TLS using ACM; the maintained
F5 NGINX Ingress Controller routes to the frontend over the cluster network.
Backend Services have no public load balancers.

Workload and network resources are kept separate: application Deployments are
in `deployments/`, data workloads are in `statefulsets/`, and every Kubernetes
Service is in `services/`.

## Before any deployment

1. Create a kOps cluster with an AWS-compatible cloud controller and install
   the **AWS EBS CSI driver** with its required IAM permissions. The
   `taskflow-gp3` StorageClass dynamically provisions encrypted gp3 volumes
   and waits for the consuming pod's Availability Zone.
2. Install the **AWS Load Balancer Controller** with IAM and subnet discovery
   configured. This controller, not NGINX, creates the ALB from
   `alb-ingress.example.yaml`. The example uses instance targets, so NGINX's
   Service must be NodePort. Do not use the retired community
   `kubernetes/ingress-nginx` project for a new deployment.
3. Install the maintained F5 NGINX Ingress Controller as release
   `taskflow-nginx` in namespace `nginx-ingress`, using
   `nginx-controller-values.yaml`. The values select a NodePort Service
   instead of creating a second AWS load balancer:

   ```sh
   kubectl apply -f deploy/kubernetes/namespace.yaml
   helm upgrade --install taskflow-nginx oci://ghcr.io/nginx/charts/nginx-ingress \
     --version 2.7.3 --namespace nginx-ingress --create-namespace \
     -f deploy/kubernetes/nginx-controller-values.yaml
   ```

   Chart 2.7.3 renders the Service
   `taskflow-nginx-nginx-ingress-controller`; the ALB Ingress backend name
   must continue to match it. The NGINX controller watches the `taskflow`
   namespace and handles the `nginx` IngressClass.
4. Build and publish the five application images for your worker-node
   architecture. The CI pipeline does not publish images. Replace all five
   `registry.example.com` image entries and `replace-me` tags in
   `kustomization.yaml`; grant nodes pull access to your registry.
5. The host is set to `deuces.dev` in `configmap.yaml`,
   `frontend-ingress.yaml`, and `alb-ingress.example.yaml`. Obtain an ACM
   certificate covering `deuces.dev`; make a private copy of the ALB
   template and replace its certificate ARN placeholder. `APP_ORIGIN` must
   exactly match the browser's HTTPS origin or mutating requests will return
   403. If you choose a subdomain instead,
   update all three files together. Also replace
   `REPLACE_WITH_BOOTSTRAP_EMAIL` in `configmap.yaml` with the intended
   initial account email.
6. Make a private copy of `secrets.example.yaml`, replace every placeholder
   with unique credentials, and keep that copy out of Git. Passwords must be
   URL-safe because the services compose PostgreSQL/AMQP URLs from them.
   Apply the private Secret before the workloads.

   ```sh
   kubectl apply -f /private/path/taskflow-secrets.yaml
   kubectl apply -k deploy/kubernetes
   kubectl apply -f /private/path/taskflow-alb-ingress.yaml
   ```

   The ALB template and Secret template are deliberately **excluded** from
   `kustomization.yaml` until their placeholders are filled. If kOps subnet
   tags do not support ALB auto-discovery, configure subnets explicitly in
   the ALB Ingress before applying it. Once the ALB is healthy, Namecheap
   BasicDNS/FreeDNS/PremiumDNS can use an apex `ALIAS` record (`@`) pointing
   to the ALB DNS name; remove any conflicting apex A/AAAA/CNAME/redirect
   record first. DNS is not changed by these manifests.

## Checks and limits

```sh
kubectl kustomize deploy/kubernetes
kubectl -n taskflow get deploy,sts,svc,pvc,ingress
kubectl -n nginx-ingress get svc,ingress
kubectl -n taskflow rollout status deployment/frontend
```

This is a first, **single-replica** configuration, not a high-availability
database or broker design. Each EBS claim is ReadWriteOnce and tied to an
Availability Zone. The StorageClass uses `Retain` so deleting a claim does
not silently delete its EBS volume; retained volumes can still incur charges.
Plan tested backups and recovery before storing production data. Kubernetes
Secrets also need appropriate API/etcd encryption, access controls, and a
rotation process. TLS ends at the ALB; internal HTTP and database connections
are not yet encrypted. No kOps cluster, add-on, image registry, DNS record, or
AWS resource is provisioned by these files.

References: [EBS CSI StorageClass parameters](https://github.com/kubernetes-sigs/aws-ebs-csi-driver/blob/master/docs/parameters.md),
[AWS Load Balancer Controller ingress annotations](https://kubernetes-sigs.github.io/aws-load-balancer-controller/latest/guide/ingress/annotations/),
[F5 NGINX Ingress Controller Helm installation](https://docs.nginx.com/nginx-ingress-controller/install/helm/open-source/),
[Namecheap apex ALIAS records](https://www.namecheap.com/support/knowledgebase/article.aspx/10128/2237/how-to-create-an-alias-record/),
and [Ingress NGINX retirement notice](https://kubernetes.io/blog/2025/11/11/ingress-nginx-retirement/).
