# Azure Cache for Redis

Optional managed replacement for the local Redis 7.4 container. Public network access is off. A private endpoint in `private-endpoints` and the `privatelink.redis.cache.windows.net` zone make the cache reachable from AKS.

Azure Cache for Redis currently offers major version 6. Auth and notifications speak the Redis protocol and accept a `rediss://` URL, so they do not need a code change. The non-TLS port is disabled.

The primary access key is an attribute of the cache and is not written to a file. Store a URL-encoded `rediss://` URL in Key Vault as `redis-url`. See `docs/ADR/0003-data-services.md`.
