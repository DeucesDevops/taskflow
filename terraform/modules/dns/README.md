# DNS

Public Azure DNS zone for the environment domain. The domain is an input. Committed examples use `example.com` only.

external-dns and cert-manager receive `DNS Zone Contributor` on this zone so they can publish records and complete DNS-01 challenges. Delegate the zone at the registrar to `name_servers` after apply.
