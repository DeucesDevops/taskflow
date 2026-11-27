"""Render the TaskFlow chart and check the service contract from Compose."""

import subprocess
import unittest
import pathlib


ROOT = pathlib.Path(__file__).resolve().parents[2]
CHART = ROOT / "helm" / "taskflow"
ARGO = ROOT / "helm" / "taskflow-argocd-application"


class ChartContractTest(unittest.TestCase):
    def render(self, chart: pathlib.Path, *extra: str) -> str:
        completed = subprocess.run(
            ["helm", "template", "taskflow", str(chart), *extra],
            check=True,
            capture_output=True,
            text=True,
        )
        return completed.stdout

    def test_services_ports_and_platform_objects(self) -> None:
        rendered = self.render(CHART, "-f", str(CHART / "values-production.yaml"))
        expected = {
            "frontend": "3000",
            "auth-service": "3001",
            "project-service": "8080",
            "task-service": "8081",
            "notification-service": "8000",
        }
        for name, port in expected.items():
            self.assertIn(f"name: {name}\n", rendered)
            self.assertIn(f"containerPort: {int(port)}\n", rendered)
        for kind in (
            "kind: Deployment",
            "kind: Service",
            "kind: Ingress",
            "kind: HorizontalPodAutoscaler",
            "kind: PodDisruptionBudget",
            "kind: ServiceAccount",
            "kind: ExternalSecret",
        ):
            self.assertIn(kind, rendered)
        self.assertIn("azure.workload.identity/use: \"true\"", rendered)
        self.assertIn("cert-manager.io/cluster-issuer:", rendered)
        self.assertIn("ingressClassName: nginx", rendered)
        self.assertIn("/ready", rendered)
        self.assertIn("/health", rendered)
        self.assertNotIn("BEGIN PRIVATE KEY", rendered)
        self.assertNotIn("change-me", rendered.lower())

    def test_argocd_application_uses_production_values(self) -> None:
        rendered = self.render(ARGO)
        self.assertIn("kind: Application", rendered)
        self.assertIn("values-production.yaml", rendered)
        self.assertIn("helm/taskflow", rendered)


if __name__ == "__main__":
    unittest.main()
