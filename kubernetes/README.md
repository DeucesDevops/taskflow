# TaskFlow Kubernetes resources

Each of the eight services has its own Deployment file and Service file, all
in this folder. Edit the YAML directly and apply it with `kubectl apply -f`.

| Component | Deployment file | Service file |
|---|---|---|
| Frontend | `frontend-deployment.yaml` | `frontend-service.yaml` |
| Auth | `auth-service-deployment.yaml` | `auth-service-service.yaml` |
| Projects | `project-service-deployment.yaml` | `project-service-service.yaml` |
| Tasks | `task-service-deployment.yaml` | `task-service-service.yaml` |
| Notifications | `notification-service-deployment.yaml` | `notification-service-service.yaml` |
| PostgreSQL | `postgres-deployment.yaml` | `postgres-service.yaml` |
| Redis | `redis-deployment.yaml` | `redis-service.yaml` |
| RabbitMQ | `rabbitmq-deployment.yaml` | `rabbitmq-service.yaml` |

Supporting files are `namespace.yaml`, `configmap.yaml`, `storage-class.yaml`,
`postgres-pvc.yaml`, `redis-pvc.yaml`, `rabbitmq-pvc.yaml`, and
`frontend-ingress.yaml`. Every namespaced resource explicitly uses `taskflow`.
Images are specified directly in the five application Deployment files;
there are no Kustomize image overrides.

PostgreSQL, Redis, and RabbitMQ each use one replica, `Recreate` updates, and
their own persistent volume. Keep these three Deployments at one replica;
this configuration does not configure data replication. Probes and resource
requests/limits are included in every Deployment.

## Configure and apply

Run commands from the repository root. These resources target the existing
kOps/AWS plan; the cluster, EBS CSI driver, and ingress controllers must already
be installed. For an existing installation, read the migration section first.

1. Edit the `image:` field in each application Deployment to a published image
   your nodes can pull. The existing Docker Hub tags are preserved. If the
   registry is private, create a registry Secret in `taskflow` and reference it
   with `imagePullSecrets` in each application pod spec.
2. Set `APP_ORIGIN` and `DEMO_EMAIL` in `configmap.yaml`. The current host is
   `taskflow.deuces.dev`; keep it aligned with both ingress rules.
3. The three PVCs select the encrypted EBS `taskflow-gp3` StorageClass defined
   in `storage-class.yaml`. The EBS CSI driver needs AWS IAM permissions. For
   another cluster, select its installed StorageClass in all three PVC files.
4. Create the namespace, then prepare the Secret from the example:

   ```sh
   kubectl apply -f kubernetes/namespace.yaml
   cp kubernetes/secrets.yaml.example kubernetes/secrets.yaml
   ```

   Fill every placeholder in `secrets.yaml` with unique credentials before
   applying it. That file is Git-ignored. Use URL-safe PostgreSQL and RabbitMQ
   passwords because the app embeds them in connection URLs. Use at least 32
   random characters for `JWT_SECRET`. If the previous Secret already exists,
   keep its credentials instead of replacing them: changing these values does
   not rotate credentials inside an existing database or broker.
5. Apply the Secret and the resources:

   ```sh
   kubectl apply -f kubernetes/secrets.yaml
   kubectl apply -f kubernetes/
   kubectl -n taskflow get deployments,pods,services,pvc,ingress
   kubectl -n taskflow rollout status deployment/frontend --timeout=300s
   ```

   You can also apply a single file, for example:

   ```sh
   kubectl apply -f kubernetes/auth-service-deployment.yaml
   kubectl apply -f kubernetes/auth-service-service.yaml
   ```

The `.example` files are skipped by directory-based `kubectl apply -f`. The
NGINX values file is Helm configuration, and the ALB/Secret examples require
configuration before applying them explicitly.

## Public HTTPS access

The existing routing remains:

```text
HTTPS → AWS ALB → F5 NGINX → frontend Service → frontend API proxy
                                                → private backend Services
```

Install the F5 NGINX Ingress Controller using the example values, which select
a NodePort Service. The AWS Load Balancer Controller must also be installed
with IAM and subnet discovery configured.

```sh
helm upgrade --install taskflow-nginx oci://ghcr.io/nginx/charts/nginx-ingress \
  --version 2.7.3 --namespace nginx-ingress --create-namespace \
  -f kubernetes/nginx-controller-values.yaml.example
```

Copy `alb-ingress.yaml.example` to a private path, set the ACM certificate ARN
and hostname, and apply that copy with `kubectl apply -f`. Its backend is
`taskflow-nginx-nginx-ingress-controller` in `nginx-ingress`; verify that this
matches the installed NGINX Service. Point the hostname's DNS at the resulting
ALB. The manifests do not create ACM certificates or DNS records.

For a local HTTP check without ingress, set `APP_ORIGIN` to
`http://localhost:3000` in the ConfigMap and `SESSION_COOKIE_SECURE` to
`"false"` in the frontend Deployment, apply both files, and restart the
frontend to load the ConfigMap change:

```sh
kubectl apply -f kubernetes/configmap.yaml
kubectl apply -f kubernetes/frontend-deployment.yaml
kubectl -n taskflow rollout restart deployment/frontend
kubectl -n taskflow port-forward service/frontend 3000:3000
```

Open `http://localhost:3000`. Restore the HTTPS origin and secure cookies before
using the public HTTPS hostname.

## Migrating the previous manifests

File moves preserve the namespace, resource names, selectors, Service ports,
image tags, and PVC names. Applying these files updates the five existing app
Deployments and eight Services in place. Applying the new data Deployments
will **not** remove the previous StatefulSets, so migrate them before the
folder-wide apply to prevent two controllers from using the same data.

1. Back up the data and inspect the existing claims:

   ```sh
   kubectl -n taskflow get pvc postgres-data redis-data rabbitmq-data \
     -o custom-columns=NAME:.metadata.name,CLASS:.spec.storageClassName,VOLUME:.spec.volumeName
   ```

   If the existing claims use `default` or another class, set the corresponding
   PVC YAML's `storageClassName` to that existing value before applying. Bound
   PVC storage classes cannot be changed in place. Do not delete claims or
   volumes to resolve a class mismatch.
2. Stop and remove the old data controllers during a maintenance window:

   ```sh
   kubectl -n taskflow scale statefulset postgres redis rabbitmq --replicas=0
   kubectl -n taskflow wait --for=delete pod/postgres-0 pod/redis-0 pod/rabbitmq-0 --timeout=300s
   kubectl -n taskflow delete statefulset postgres redis rabbitmq
   ```

   Proceed only after the old pods have terminated. The previous manifests use
   standalone PVCs, so deleting these StatefulSets leaves the claims intact.
3. Apply the folder as above. The new data Deployments mount `postgres-data`,
   `redis-data`, and `rabbitmq-data`. Once the replacement pods are healthy,
   remove the unused headless Services:

   ```sh
   kubectl -n taskflow delete service postgres-headless redis-headless rabbitmq-headless --ignore-not-found
   ```

## Verification

```sh
kubectl apply --dry-run=server -f kubernetes/
kubectl -n taskflow get pods,pvc
kubectl -n taskflow describe pod <pod-name>
kubectl -n taskflow logs deployment/<service-name>
```

A server dry run needs a configured cluster and the namespace/Secret setup.
Pending PVCs usually require checking the selected StorageClass, EBS CSI driver,
and volume placement. `ImagePullBackOff` requires checking the image tag and
registry access. `CreateContainerConfigError` requires checking Secret and
ConfigMap keys. These files have been validated as manifests; a live rollout
still depends on your cluster, published images, credentials, and controllers.

References: [kubectl apply](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_apply/),
[Deployment updates](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/),
[persistent volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/),
and [EBS CSI StorageClass parameters](https://github.com/kubernetes-sigs/aws-ebs-csi-driver/blob/master/docs/parameters.md).
