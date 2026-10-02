import unittest
from uuid import uuid4

import httpx
from fastapi.testclient import TestClient
from redis.exceptions import ConnectionError

from app.config import Settings
from app.main import create_app
from app.models import Event

USER_ID = "11111111-1111-4111-8111-111111111111"


def event():
    return {"id": str(uuid4()), "userId": USER_ID, "type": "task.created", "message": "Created task: Ship release", "taskId": str(uuid4()), "projectId": str(uuid4()), "createdAt": "2026-09-18T10:00:00Z"}


class FakeStore:
    def __init__(self):
        self.events = []
        self.requested_users = []
        self.fail = False

    async def ping(self):
        return None

    async def ingest(self, received):
        if self.fail:
            raise ConnectionError("private connection details")
        self.events.append(received)

    async def list(self, user_id):
        if self.fail:
            raise ConnectionError("private connection details")
        self.requested_users.append(user_id)
        return [e.notification() for e in self.events if str(e.userId) == user_id]


class APITest(unittest.TestCase):
    def setUp(self):
        self.store = FakeStore()
        self.auth_status = 200
        self.auth_headers = []

        def auth(request):
            self.auth_headers.append(request.headers.get("Authorization"))
            return httpx.Response(self.auth_status, json={"user": {"id": USER_ID}})

        self.http = httpx.AsyncClient(transport=httpx.MockTransport(auth))
        config = Settings("redis://unused", "http://auth-service:3001", "amqp://unused", "taskflow.notifications")
        self.client = self.enterContext(TestClient(create_app(config, self.store, self.http, start_consumer=False)))

    def test_new_task_event_types_reach_the_authenticated_feed(self):
        for event_type in ["task.assigned", "task.commented", "task.deleted"]:
            payload = event()
            payload["type"] = event_type
            import asyncio
            asyncio.run(self.store.ingest(Event.model_validate(payload)))
        feed = self.client.get("/notifications", headers={"Authorization": "Bearer session"}).json()["items"]
        self.assertEqual([item["type"] for item in feed], ["task.assigned", "task.commented", "task.deleted"])
        self.assertTrue(all("userId" not in item for item in feed))

    def test_user_identity_comes_only_from_auth_service(self):
        payload = event()
        import asyncio
        asyncio.run(self.store.ingest(Event.model_validate(payload)))
        result = self.client.get("/notifications?userId=someone-else", headers={"Authorization": "Bearer session"})
        self.assertEqual(result.status_code, 200)
        self.assertEqual(self.store.requested_users, [USER_ID])
        self.assertEqual(self.auth_headers, ["Bearer session"])
        item = result.json()["items"][0]
        self.assertEqual(item["id"], payload["id"])
        self.assertNotIn("userId", item)

    def test_authentication_is_required_and_failures_are_safe(self):
        self.assertEqual(self.client.get("/notifications").status_code, 401)
        self.auth_status = 503
        result = self.client.get("/notifications", headers={"Authorization": "Bearer session"})
        self.assertEqual(result.status_code, 503)
        self.assertEqual(result.json(), {"error": "Authentication service unavailable"})
        self.assertEqual(self.store.requested_users, [])

    def test_storage_failure_does_not_leak_details(self):
        self.store.fail = True
        result = self.client.get("/notifications", headers={"Authorization": "Bearer session"})
        self.assertEqual(result.status_code, 503)
        self.assertEqual(result.json(), {"error": "Notification storage unavailable"})

    def test_event_ingestion_is_not_exposed_over_http(self):
        self.assertEqual(self.client.post("/events", json=event()).status_code, 404)


if __name__ == "__main__":
    unittest.main()
