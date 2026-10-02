import logging

import aio_pika
from pydantic import ValidationError

from .models import Event
from .store import NotificationStore

logger = logging.getLogger("taskflow.notifications")


class RabbitConsumer:
    def __init__(self, url: str, queue_name: str, store: NotificationStore):
        self.url = url
        self.queue_name = queue_name
        self.store = store
        self.connection = None
        self.channel = None

    async def start(self):
        self.connection = await aio_pika.connect_robust(self.url, timeout=5)
        self.channel = await self.connection.channel()
        await self.channel.set_qos(prefetch_count=20)
        queue = await self.channel.declare_queue(self.queue_name, durable=True)
        await queue.consume(self.handle)

    async def handle(self, message: aio_pika.IncomingMessage):
        try:
            event = Event.model_validate_json(message.body)
        except ValidationError:
            logger.warning("Rejected invalid notification event", extra={"message_id": message.message_id})
            await message.reject(requeue=False)
            return
        try:
            await self.store.ingest(event)
        except Exception:
            logger.exception("Notification event storage failed", extra={"event_id": str(event.id)})
            await message.nack(requeue=True)
            return
        await message.ack()

    def ready(self) -> bool:
        return bool(
            self.connection
            and not self.connection.is_closed
            and self.channel
            and not self.channel.is_closed
        )

    async def close(self):
        if self.connection and not self.connection.is_closed:
            await self.connection.close()
