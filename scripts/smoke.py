#!/usr/bin/env python3
"""Exercise the public frontend API and the full service chain; standard library only."""
import http.cookiejar
import json
import os
import time
import urllib.error
import urllib.request
import uuid

BASE = os.environ.get('TASKFLOW_URL', 'http://localhost:3000').rstrip('/')
jar = http.cookiejar.CookieJar()
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def request(path, method='GET', body=None, expected=200, origin=None):
    headers = {'Accept': 'application/json'}
    if method != 'GET':
        headers['Origin'] = origin or BASE
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        response = client.open(req, timeout=15)
    except urllib.error.HTTPError as error:
        response = error
    raw = response.read().decode()
    assert response.code == expected, f'{method} {path}: wanted {expected}, got {response.code}: {raw}'
    return json.loads(raw) if raw else None


request('/health')
request('/ready')
request('/api/projects', expected=401)
request('/api/auth/login', 'POST', {'email': 'nobody@example.test', 'password': 'wrong-password'}, expected=401)
login = request('/api/auth/login', 'POST', {
    'email': os.environ.get('DEMO_EMAIL', 'alex@taskflow.local'),
    'password': os.environ.get('DEMO_PASSWORD', 'taskflow-local-demo'),
})
assert 'token' not in login, 'Bearer token must stay in the httpOnly cookie'
assert any(cookie.has_nonstandard_attr('HttpOnly') for cookie in jar), 'Session cookie must be httpOnly'
user = request('/api/auth/me')['user']
assert user['id'] == '11111111-1111-4111-8111-111111111111'
request('/api/projects', 'POST', {'name': 'CSRF attempt'}, expected=403, origin='https://untrusted.example')
project = request('/api/projects', 'POST', {
    'name': f'Smoke check {uuid.uuid4().hex[:8]}',
    'description': 'Created by the automated Milestone 1 smoke check.',
}, expected=201)
assert project['ownerId'] == user['id']
assert any(item['id'] == project['id'] for item in request('/api/projects')['items'])
request('/api/tasks?projectId=' + str(uuid.uuid4()), expected=404)
task = request('/api/tasks', 'POST', {'projectId': project['id'], 'title': 'Verify end-to-end task flow'}, expected=201)
assert task['status'] == 'todo'
request('/api/tasks/' + task['id'], 'PATCH', {'status': 'not-a-status'}, expected=400)
updated = request('/api/tasks/' + task['id'], 'PATCH', {'status': 'in_progress'})
assert updated['status'] == 'in_progress'
updated = request('/api/tasks/' + task['id'], 'PATCH', {'status': 'done'})
assert updated['status'] == 'done'
assert any(item['id'] == task['id'] and item['status'] == 'done' for item in request('/api/tasks?projectId=' + project['id'])['items'])
for _ in range(10):
    notifications = request('/api/notifications')['items']
    if any(item['taskId'] == task['id'] and item['type'] == 'task.created' for item in notifications):
        break
    time.sleep(0.2)
else:
    raise AssertionError('Task creation notification did not arrive')
request('/api/auth/logout', 'POST', expected=204)
request('/api/auth/me', expected=401)
print('PASS: health, readiness, login, httpOnly cookie, access control, CSRF, projects, tasks, notifications, logout')
print(f'Persisted smoke project: {project["id"]}')
print(f'Persisted smoke task: {task["id"]}')
