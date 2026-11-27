# Incident

1. `make kubeconfig ENV=production`
2. `kubectl get pods -n taskflow` and `kubectl describe ingress frontend -n taskflow`
3. Readiness is `/ready`. Liveness is `/health`. A pod that is alive but not ready has lost Postgres, Redis, RabbitMQ, or auth.
4. `kubectl logs deploy/notification-service -n taskflow` for queue consumption. The queue name is `taskflow.notifications`.
5. Grafana is in the `monitoring` namespace. The admin password is the `grafana-admin-credentials` secret, not a value in git.
6. Container Insights is the Log Analytics workspace named like `aks-taskflow-prod-logs`.
7. Alerts in `observability/alerts/taskflow.yaml` cover missing replicas, restarts, the frontend ingress, and the notification backlog.

Scale a service by changing `replicas` in the Helm values and letting Argo CD sync. The user node pool autoscales.
