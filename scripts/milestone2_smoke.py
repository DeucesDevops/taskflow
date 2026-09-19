#!/usr/bin/env python3
"""Exercise Milestone 2 registration, teams, assignments, comments and archival."""
import http.cookiejar
import json
import os
import time
import urllib.error
import urllib.request
import uuid

BASE = os.environ.get("TASKFLOW_URL", "http://localhost:3000").rstrip("/")


class Client:
    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.http = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def request(self, path, method="GET", body=None, expected=200):
        headers = {"Accept": "application/json"}
        data = None
        if method != "GET":
            headers["Origin"] = BASE
        if body is not None:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
        request = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
        try:
            response = self.http.open(request, timeout=15)
        except urllib.error.HTTPError as error:
            response = error
        raw = response.read().decode()
        assert response.code == expected, (
            f"{method} {path}: wanted {expected}, got {response.code}: {raw}"
        )
        return json.loads(raw) if raw else None

    def register(self, name, email):
        result = self.request("/api/auth/register", "POST", {
            "name": name,
            "email": email,
            "password": "milestone-2-password",
        }, 201)
        assert result["user"]["email"] == email
        assert "token" not in result
        assert any(cookie.has_nonstandard_attr("HttpOnly") for cookie in self.jar)
        return result["user"]


suffix = uuid.uuid4().hex[:10]
owner_email = f"owner-{suffix}@example.test"
member_email = f"member-{suffix}@example.test"
outsider_email = f"outsider-{suffix}@example.test"
owner, member, outsider = Client(), Client(), Client()
owner_user = owner.register("Milestone Owner", owner_email)
member_user = member.register("Milestone Member", member_email)
outsider.register("Milestone Outsider", outsider_email)

project = owner.request("/api/projects", "POST", {
    "name": f"Milestone 2 {suffix}",
    "description": "Team workflow integration check",
}, 201)
assert project["role"] == "owner"
project = owner.request(f"/api/projects/{project['id']}", "PATCH", {
    "name": project["name"],
    "description": "Edited before team collaboration",
})
assert project["description"] == "Edited before team collaboration"

added = owner.request(f"/api/projects/{project['id']}/members", "POST", {
    "email": member_email,
}, 201)
assert added["userId"] == member_user["id"] and added["role"] == "member"
team = owner.request(f"/api/projects/{project['id']}/members")["items"]
assert {person["userId"] for person in team} == {owner_user["id"], member_user["id"]}
assert any(item["id"] == project["id"] and item["role"] == "member"
           for item in member.request("/api/projects?limit=1")["items"])
outsider.request(f"/api/projects/{project['id']}", expected=404)

task = owner.request("/api/tasks", "POST", {
    "projectId": project["id"],
    "title": "Review durable event delivery",
    "description": "Validate assignment and comments through every service.",
    "assigneeId": member_user["id"],
}, 201)
assert task["assigneeId"] == member_user["id"]
assert task["assigneeName"] == "Milestone Member"

comment = member.request(f"/api/tasks/{task['id']}/comments", "POST", {
    "body": "The team workflow is connected.",
}, 201)
assert comment["userId"] == member_user["id"]
comments = owner.request(f"/api/tasks/{task['id']}/comments?limit=1")
assert comments["items"][0]["id"] == comment["id"] and comments["hasMore"] is False

updated = member.request(f"/api/tasks/{task['id']}", "PATCH", {
    "status": "in_progress",
    "description": "The member can update shared work.",
})
assert updated["status"] == "in_progress"
outsider.request(f"/api/tasks/{task['id']}", expected=404)
outsider.request(f"/api/tasks/{task['id']}/comments", "POST", {"body": "No access"}, 404)

for _ in range(30):
    owner_events = owner.request("/api/notifications")["items"]
    member_events = member.request("/api/notifications")["items"]
    if (any(event["taskId"] == task["id"] and event["type"] == "task.assigned"
            for event in owner_events)
            and any(event["taskId"] == task["id"] and event["type"] == "task.assigned"
                    for event in member_events)
            and any(event["taskId"] == task["id"] and event["type"] == "task.commented"
                    for event in member_events)):
        break
    time.sleep(0.25)
else:
    raise AssertionError("Durable assignment/comment notifications did not arrive")

owner.request(f"/api/projects/{project['id']}", "DELETE", expected=204)
assert not any(item["id"] == project["id"] for item in member.request("/api/projects")["items"])
member.request(f"/api/tasks/{task['id']}", expected=404)

print("PASS: registration, JWT sessions, pagination, project editing, membership,")
print("      assignment, comments, access isolation, durable notifications and archival")
