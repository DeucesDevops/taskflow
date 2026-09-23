#!/usr/bin/env python3
"""Verify the security and runtime contract of the running Compose stack."""

import json
import pathlib
import re
import subprocess
import sys


ROOT = pathlib.Path(__file__).resolve().parent.parent
APP_SERVICES = (
    "auth-service",
    "project-service",
    "task-service",
    "notification-service",
    "frontend",
)
ALL_SERVICES = ("postgres", "redis", *APP_SERVICES)
SENSITIVE_ENV = {"POSTGRES_PASSWORD", "JWT_SECRET", "INTERNAL_API_KEY", "DB_PASSWORD", "DATABASE_URL"}


def run(*args: str) -> str:
    result = subprocess.run(
        args,
        cwd=ROOT,
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return result.stdout.strip()


def check(condition: bool, message: str, failures: list[str]) -> None:
    if not condition:
        failures.append(message)


def container(service: str) -> dict:
    container_id = run("docker", "compose", "ps", "-q", service)
    if not container_id:
        raise RuntimeError(f"{service} is not running")
    return json.loads(run("docker", "inspect", container_id))[0]


def main() -> int:
    failures: list[str] = []
    inspected = {service: container(service) for service in ALL_SERVICES}
    compose_config = json.loads(run("docker", "compose", "config", "--format", "json"))
    project_name = compose_config["name"]
    images = {
        service: json.loads(
            run(
                "docker",
                "image",
                "inspect",
                compose_config["services"][service].get("image")
                or f"{project_name}-{service}:latest",
            )
        )[0]
        for service in APP_SERVICES
    }

    for service, details in inspected.items():
        health = details["State"].get("Health", {}).get("Status")
        check(health == "healthy", f"{service}: expected healthy state, got {health!r}", failures)

        bindings = details["HostConfig"].get("PortBindings") or {}
        for port, entries in bindings.items():
            for entry in entries or []:
                host = entry.get("HostIp")
                check(
                    host in {"127.0.0.1", "::1"},
                    f"{service}: {port} is published on non-loopback address {host!r}",
                    failures,
                )

        host = details["HostConfig"]
        check(0 < int(host.get("PidsLimit") or 0) <= 512, f"{service}: PID limit is missing or too high", failures)
        check(int(host.get("Memory") or 0) > 0, f"{service}: memory limit is missing", failures)
        check(int(host.get("NanoCpus") or 0) > 0, f"{service}: CPU limit is missing", failures)

    for service in APP_SERVICES:
        details = inspected[service]
        config = details["Config"]
        host = details["HostConfig"]
        user = config.get("User", "")
        check(bool(user) and user.split(":", 1)[0] not in {"0", "root"}, f"{service}: image user is root", failures)
        check(bool(config.get("Healthcheck", {}).get("Test")), f"{service}: image has no healthcheck", failures)
        check(host.get("ReadonlyRootfs") is True, f"{service}: root filesystem is writable", failures)
        check("no-new-privileges:true" in (host.get("SecurityOpt") or []), f"{service}: no-new-privileges is missing", failures)
        check("ALL" in (host.get("CapDrop") or []), f"{service}: Linux capabilities are not dropped", failures)
        tmpfs = host.get("Tmpfs") or {}
        tmp_options = tmpfs.get("/tmp", "")
        check("noexec" in tmp_options and "nosuid" in tmp_options, f"{service}: hardened /tmp tmpfs is missing", failures)

        image_config = images[service].get("Config") or {}
        baked_names = {value.split("=", 1)[0] for value in image_config.get("Env") or []}
        leaked = sorted(SENSITIVE_ENV & baked_names)
        check(not leaked, f"{service}: sensitive environment names baked into image: {', '.join(leaked)}", failures)

    redis_user = inspected["redis"]["Config"].get("User", "")
    check(
        bool(redis_user) and redis_user.split(":", 1)[0] not in {"0", "root"},
        "redis: container user is root",
        failures,
    )

    backend_networks = [
        details for name, details in inspected["frontend"]["NetworkSettings"]["Networks"].items()
        if name.endswith("_backend")
    ]
    check(len(backend_networks) == 1, "frontend: expected exactly one backend network", failures)
    if not backend_networks:
        network_id = ""
    else:
        network_id = backend_networks[0]["NetworkID"]
    if network_id:
        network = json.loads(run("docker", "network", "inspect", network_id))[0]
        check(network.get("Internal") is True, "backend network is not internal", failures)

    for dockerfile in ROOT.glob("*/Dockerfile"):
        stages: set[str] = set()
        for line_number, line in enumerate(dockerfile.read_text().splitlines(), 1):
            if re.match(r"^FROM\s+", line, flags=re.IGNORECASE):
                parts = line.split()
                image = parts[1]
                check(
                    image in stages or "@sha256:" in image,
                    f"{dockerfile.relative_to(ROOT)}:{line_number}: base image is not digest-pinned",
                    failures,
                )
                if len(parts) >= 4 and parts[-2].lower() == "as":
                    stages.add(parts[-1])

    if failures:
        print("Container policy failed:", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        return 1

    print("PASS: all services are healthy; application containers are non-root, read-only,")
    print("      resource-bounded, capability-free, digest-pinned, and loopback-only")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
