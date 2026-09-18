import asyncio
from datetime import datetime, timezone
import os
import unittest
from uuid import uuid4

from redis.asyncio import Redis

from app.models import Event
from app.store import NotificationStore


@unittest.skipUnless(os.getenv("NOTIFICATION_TEST_REDIS_URL"), "Set NOTIFICATION_TEST_REDIS_URL for real Redis integration tests")
class RedisStoreTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.redis = Redis.from_url(os.environ["NOTIFICATION_TEST_REDIS_URL"], decode_responses=True)
        self.prefix = f"taskflow:test:{uuid4()}"
        self.store = NotificationStore(self.redis, self.prefix)
        self.user = uuid4()

    async def asyncTearDown(self):
        keys = [key async for key in self.redis.scan_iter(f"{self.prefix}:*")]
        if keys:
            await self.redis.delete(*keys)
        await self.redis.aclose()

    def event(self):
        return Event(id=uuid4(), userId=self.user, type="task.created", message="Created task: Test", taskId=uuid4(), projectId=uuid4(), createdAt=datetime.now(timezone.utc))

    async def test_concurrent_redelivery_is_idempotent(self):
        event = self.event()
        results = await asyncio.gather(*(self.store.ingest(event) for _ in range(20)))
        self.assertEqual(sum(results), 1)
        self.assertEqual(len(await self.store.list(str(self.user))), 1)
        self.assertEqual(await self.store.list(str(uuid4())), [])

    async def test_feed_is_capped_newest_first_and_expires(self):
        latest = None
        for _ in range(105):
            latest = self.event()
            await self.store.ingest(latest)
        items = await self.store.list(str(self.user))
        self.assertEqual(len(items), 100)
        self.assertEqual(items[0]["id"], str(latest.id))
        ttl = await self.redis.ttl(f"{self.prefix}:user:{self.user}")
        self.assertGreater(ttl, 604790)
        self.assertLessEqual(ttl, 604800)


if __name__ == "__main__":
    unittest.main()
