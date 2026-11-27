locals {
  platform_identities = {
    "external-dns" = {
      namespace       = "external-dns"
      service_account = "external-dns"
    }
    "external-secrets" = {
      namespace       = "external-secrets"
      service_account = "external-secrets"
    }
    "cert-manager" = {
      namespace       = "cert-manager"
      service_account = "cert-manager"
    }
  }

  application_service_accounts = toset([
    "frontend",
    "auth-service",
    "project-service",
    "task-service",
    "notification-service",
  ])

  github_subjects = [
    "repo:${var.github_repository}:pull_request",
    "repo:${var.github_repository}:ref:refs/heads/dev",
    "repo:${var.github_repository}:environment:dev",
    "repo:${var.github_repository}:environment:production",
  ]
}
