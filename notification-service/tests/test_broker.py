import asyncio
import unittest

from app.broker import RabbitConsumer


class FakeStore:
    def __init__(self, fail=False):
        self.events = []
        self.fail = fail

    async def ingest(self, event):
        if self.fail:
            raise RuntimeError("offline")
        self.events.append(event)


class FakeMessage:
    def __init__(self, body):
        self.body = body
        self.message_id = "event-id"
        self.action = None

    async def ack(self):
        self.action = "ack"

    async def nack(self, requeue):
        self.action = f"nack:{requeue}"

    async def reject(self, requeue):
        self.action = f"reject:{requeue}"


VALID = b'{"id":"11111111-1111-4111-8111-111111111111","userId":"22222222-2222-4222-8222-222222222222","type":"task.created","message":"Created task","taskId":"33333333-3333-4333-8333-333333333333","projectId":"44444444-4444-4444-8444-444444444444","createdAt":"2026-09-25T10:00:00Z"}'


class BrokerTest(unittest.TestCase):
    def test_valid_event_is_stored_before_acknowledgement(self):
        store, message = FakeStore(), FakeMessage(VALID)
        asyncio.run(RabbitConsumer("amqp://unused", "queue", store).handle(message))
        self.assertEqual(message.action, "ack")
        self.assertEqual(len(store.events), 1)

    def test_storage_failure_requeues_event(self):
        message = FakeMessage(VALID)
        asyncio.run(RabbitConsumer("amqp://unused", "queue", FakeStore(fail=True)).handle(message))
        self.assertEqual(message.action, "nack:True")

    def test_invalid_event_is_rejected_without_requeue(self):
        message = FakeMessage(b'{"type":"unknown"}')
        asyncio.run(RabbitConsumer("amqp://unused", "queue", FakeStore()).handle(message))
        self.assertEqual(message.action, "reject:False")


if __name__ == "__main__":
    unittest.main()
