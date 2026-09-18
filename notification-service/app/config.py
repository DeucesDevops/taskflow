from dataclasses import dataclass
import os
from urllib.parse import urlparse


@dataclass(frozen=True)
class Settings:
    redis_url: str
    auth_service_url: str
    internal_api_key: str

    @classmethod
    def from_env(cls) -> "Settings":
        redis_url = os.environ.get("REDIS_URL", "")
        auth_url = os.environ.get("AUTH_SERVICE_URL", "").rstrip("/")
        internal_key = os.environ.get("INTERNAL_API_KEY", "")
        if not redis_url or not internal_key:
            raise ValueError("REDIS_URL and INTERNAL_API_KEY are required")
        if urlparse(redis_url).scheme not in {"redis", "rediss"}:
            raise ValueError("REDIS_URL must use redis or rediss")
        auth = urlparse(auth_url)
        if auth.scheme not in {"http", "https"} or not auth.netloc or auth.username or auth.query or auth.fragment:
            raise ValueError("AUTH_SERVICE_URL must be an HTTP service URL")
        return cls(redis_url, auth_url, internal_key)
