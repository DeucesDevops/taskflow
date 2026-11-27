# Registry

Azure Container Registry for TaskFlow images. Admin credentials are disabled. The AKS kubelet identity receives `AcrPull` on this registry, so nodes pull images without an image pull secret.

The registry endpoint stays reachable from GitHub-hosted runners, which push images with the federated GitHub identity (`AcrPush` is granted in the identity module). Anonymous pull is disabled.
