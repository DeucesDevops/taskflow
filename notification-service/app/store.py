import json

from redis.asyncio import Redis

from .models import Event

# One script makes deduplication and insertion atomic, including under concurrent deliveries.
_INGEST = """
if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
redis.call('LPUSH', KEYS[2], ARGV[1])
redis.call('LTRIM', KEYS[2], 0, 99)
redis.call('EXPIRE', KEYS[2], ARGV[2])
redis.call('SET', KEYS[1], '1', 'EX', ARGV[2])
return 1
"""


class NotificationStore:
    def __init__(self, redis: Redis, prefix: str = "taskflow:notifications"):
        self.redis = redis
        self.prefix = prefix

    async def ingest(self, event: Event) -> bool:
        return bool(await self.redis.eval(
            _INGEST, 2,
            f"{self.prefix}:event:{event.id}",
            f"{self.prefix}:user:{event.userId}",
            json.dumps(event.notification(), separators=(",", ":")),
            7 * 24 * 60 * 60,
        ))

    async def list(self, user_id: str) -> list[dict]:
        entries = await self.redis.lrange(f"{self.prefix}:user:{user_id}", 0, 99)
        return [json.loads(entry) for entry in entries]

    async def ping(self) -> None:
        await self.redis.ping()
