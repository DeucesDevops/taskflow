from dataclasses import dataclass
import os
from urllib.parse import urlparse


@dataclass(frozen=True)
class Settings:
    redis_url: str
    auth_service_url: str
    rabbitmq_url: str
    rabbitmq_queue: str

    @classmethod
    def from_env(cls) -> "Settings":
        redis_url = os.environ.get("REDIS_URL", "")
        auth_url = os.environ.get("AUTH_SERVICE_URL", "").rstrip("/")
        rabbitmq_url = os.environ.get("RABBITMQ_URL", "")
        rabbitmq_queue = os.environ.get("RABBITMQ_QUEUE", "taskflow.notifications")
        if not redis_url or not rabbitmq_url or not rabbitmq_queue:
            raise ValueError("REDIS_URL, RABBITMQ_URL, and RABBITMQ_QUEUE are required")
        if urlparse(redis_url).scheme not in {"redis", "rediss"}:
            raise ValueError("REDIS_URL must use redis or rediss")
        auth = urlparse(auth_url)
        if auth.scheme not in {"http", "https"} or not auth.netloc or auth.username or auth.query or auth.fragment:
            raise ValueError("AUTH_SERVICE_URL must be an HTTP service URL")
        rabbitmq = urlparse(rabbitmq_url)
        if rabbitmq.scheme not in {"amqp", "amqps"} or not rabbitmq.netloc or rabbitmq.query or rabbitmq.fragment:
            raise ValueError("RABBITMQ_URL must be an AMQP service URL")
        return cls(redis_url, auth_url, rabbitmq_url, rabbitmq_queue)
