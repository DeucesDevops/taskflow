# Platform addons

Status: folder scaffold; implementation pending.

Independent addon release configuration belongs under ingress/, storage/, secrets/ and observability/. Keep these releases distinct from application manifests in kubernetes/ and from kOps-managed addons.

Next: assign one owner per addon and select compatible pinned versions before adding release configuration.

See [stage 7](../docs/plans/implementation-plan.md#7-install-platform-addons-and-secrets-delivery).
