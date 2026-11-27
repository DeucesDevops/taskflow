locals {
  values_dir = "${path.module}/../../../platform"
}

resource "kubernetes_namespace" "this" {
  for_each = toset([
    "ingress-nginx",
    "cert-manager",
    "external-dns",
    "external-secrets",
    "argocd",
    "monitoring",
    "rabbitmq",
    "taskflow",
  ])

  metadata {
    name = each.value
  }
}

resource "random_password" "rabbitmq" {
  length  = 32
  special = false
}

resource "random_password" "grafana" {
  length  = 32
  special = false
}

resource "kubernetes_secret" "broker" {
  metadata {
    name      = "broker"
    namespace = kubernetes_namespace.this["rabbitmq"].metadata[0].name
  }

  data = {
    credential = random_password.rabbitmq.result
  }
}

resource "kubernetes_secret" "rabbitmq_connection" {
  metadata {
    name      = "rabbitmq-connection"
    namespace = kubernetes_namespace.this["taskflow"].metadata[0].name
  }

  data = {
    RABBITMQ_URL = "amqp://${var.rabbitmq_username}:${random_password.rabbitmq.result}@rabbitmq.rabbitmq.svc.cluster.local:5672/"
  }
}

resource "kubernetes_secret" "grafana_admin" {
  metadata {
    name      = "grafana-admin-credentials"
    namespace = kubernetes_namespace.this["monitoring"].metadata[0].name
  }

  data = {
    "admin-user"     = "admin"
    "admin-password" = random_password.grafana.result
  }
}

resource "helm_release" "ingress_nginx" {
  name       = "ingress-nginx"
  namespace  = kubernetes_namespace.this["ingress-nginx"].metadata[0].name
  repository = "https://kubernetes.github.io/ingress-nginx"
  chart      = "ingress-nginx"
  version    = var.ingress_nginx_chart_version
  wait       = true
  timeout    = 600

  values = [
    file("${local.values_dir}/ingress-nginx-values.yaml"),
    yamlencode({
      controller = {
        replicaCount = var.ingress_replicas
      }
    }),
  ]
}

resource "helm_release" "cert_manager" {
  name       = "cert-manager"
  namespace  = kubernetes_namespace.this["cert-manager"].metadata[0].name
  repository = "https://charts.jetstack.io"
  chart      = "cert-manager"
  version    = var.cert_manager_chart_version
  wait       = true
  timeout    = 600

  values = [
    file("${local.values_dir}/cert-manager/values.yaml"),
    yamlencode({
      serviceAccount = {
        annotations = {
          "azure.workload.identity/client-id" = var.cert_manager_client_id
        }
      }
    }),
  ]
}

resource "helm_release" "external_dns" {
  name       = "external-dns"
  namespace  = kubernetes_namespace.this["external-dns"].metadata[0].name
  repository = "https://kubernetes-sigs.github.io/external-dns"
  chart      = "external-dns"
  version    = var.external_dns_chart_version
  wait       = true
  timeout    = 600

  values = [
    file("${local.values_dir}/external-dns-values.yaml"),
    yamlencode({
      domainFilters = [var.domain_name]
      txtOwnerId    = "taskflow-${replace(var.domain_name, ".", "-")}"
      serviceAccount = {
        annotations = {
          "azure.workload.identity/client-id" = var.external_dns_client_id
        }
      }
      env = [
        { name = "AZURE_SUBSCRIPTION_ID", value = var.subscription_id },
        { name = "AZURE_TENANT_ID", value = var.tenant_id },
        { name = "AZURE_RESOURCE_GROUP", value = var.dns_resource_group_name },
      ]
    }),
  ]

  depends_on = [helm_release.ingress_nginx]
}

resource "helm_release" "external_secrets" {
  name       = "external-secrets"
  namespace  = kubernetes_namespace.this["external-secrets"].metadata[0].name
  repository = "https://charts.external-secrets.io"
  chart      = "external-secrets"
  version    = var.external_secrets_chart_version
  wait       = true
  timeout    = 600

  values = [
    file("${local.values_dir}/external-secrets/values.yaml"),
    yamlencode({
      serviceAccount = {
        annotations = {
          "azure.workload.identity/client-id" = var.external_secrets_client_id
        }
      }
    }),
  ]
}

resource "helm_release" "argocd" {
  name       = "argocd"
  namespace  = kubernetes_namespace.this["argocd"].metadata[0].name
  repository = "https://argoproj.github.io/argo-helm"
  chart      = "argo-cd"
  version    = var.argocd_chart_version
  wait       = true
  timeout    = 900

  values = [
    file("${local.values_dir}/argocd-values.yaml"),
    yamlencode({
      server = {
        ingress = {
          hostname = "argocd.${var.domain_name}"
        }
      }
    }),
  ]

  depends_on = [helm_release.ingress_nginx, helm_release.cert_manager]
}

resource "helm_release" "kube_prometheus_stack" {
  name       = "kube-prometheus-stack"
  namespace  = kubernetes_namespace.this["monitoring"].metadata[0].name
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "kube-prometheus-stack"
  version    = var.kube_prometheus_stack_chart_version
  wait       = true
  timeout    = 900

  values = [
    file("${local.values_dir}/monitoring-values.yaml"),
    yamlencode({
      prometheus = {
        prometheusSpec = {
          retention = var.prometheus_retention
          storageSpec = {
            volumeClaimTemplate = {
              spec = {
                resources = {
                  requests = {
                    storage = var.prometheus_storage_size
                  }
                }
              }
            }
          }
        }
      }
    }),
  ]

  depends_on = [kubernetes_secret.grafana_admin]
}

resource "helm_release" "rabbitmq" {
  name       = "rabbitmq"
  namespace  = kubernetes_namespace.this["rabbitmq"].metadata[0].name
  repository = "oci://registry-1.docker.io/bitnamicharts"
  chart      = "rabbitmq"
  version    = var.rabbitmq_chart_version
  wait       = true
  timeout    = 900

  values = [
    file("${local.values_dir}/rabbitmq-values.yaml"),
    yamlencode({
      persistence = {
        size = var.rabbitmq_storage_size
      }
    }),
  ]

  set {
    name  = "auth.username"
    value = var.rabbitmq_username
  }

  set {
    name  = "auth.existingPasswordSecret"
    value = kubernetes_secret.broker.metadata[0].name
  }

  set {
    name  = "auth.existingSecretPasswordKey"
    value = "credential"
  }

  depends_on = [kubernetes_secret.broker]
}
