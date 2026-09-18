// Run inside the auth container: docker compose exec -T auth-service node --input-type=module < scripts/check-isolation.mjs
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import pg from 'pg';
import { createClient } from 'redis';
import { hashPassword } from './dist/password.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const userId = randomUUID();
const email = `isolation-${userId}@example.test`;
const password = randomBytes(24).toString('hex');
const auth = 'http://auth-service:3001';
const projects = 'http://project-service:8080';
const tasks = 'http://task-service:8081';
const notifications = 'http://notification-service:8000';
let session;
let ownerSession;
let ownerTask;
async function call(base, path, token, method = 'GET', body) {
  return fetch(base + path, { method, headers: {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(body ? { 'Content-Type': 'application/json' } : {}),
  }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000) });
}
try {
  await pool.query('INSERT INTO auth.users (id,name,email,password_hash) VALUES ($1,$2,$3,$4)',
    [userId, 'Isolation check', email, await hashPassword(password)]);
  const login = await call(auth, '/auth/login', null, 'POST', { email, password });
  assert.equal(login.status, 200);
  session = (await login.json()).token;
  const ownerLogin = await call(auth, '/auth/login', null, 'POST', {
    email: process.env.DEMO_EMAIL, password: process.env.DEMO_PASSWORD,
  });
  assert.equal(ownerLogin.status, 200);
  ownerSession = (await ownerLogin.json()).token;
  const projectId = '22222222-2222-4222-8222-222222222222';
  assert.deepEqual((await (await call(projects, '/projects', session)).json()).items, []);
  assert.equal((await call(projects, `/projects/${projectId}`, session)).status, 404);
  assert.equal((await call(tasks, `/tasks?projectId=${projectId}`, session)).status, 404);
  assert.equal((await call(tasks, '/tasks', session, 'POST', { projectId, title: 'Forbidden task' })).status, 404);
  const created = await call(tasks, '/tasks', ownerSession, 'POST', { projectId, title: 'Temporary isolation check' });
  assert.equal(created.status, 201);
  ownerTask = (await created.json()).id;
  assert.equal((await call(tasks, `/tasks/${ownerTask}`, session, 'PATCH', { status: 'done' })).status, 404);
  const ownerTasks = (await (await call(tasks, `/tasks?projectId=${projectId}`, ownerSession)).json()).items;
  assert.equal(ownerTasks.find(task => task.id === ownerTask).status, 'todo');
  assert.deepEqual((await (await call(notifications, '/notifications', session)).json()).items, []);
  const noKey = await call(notifications, '/events', null, 'POST', {
    id: randomUUID(), userId, type: 'task.created', message: 'Unauthorized event',
    taskId: randomUUID(), projectId, createdAt: new Date().toISOString(),
  });
  assert.ok([401, 403].includes(noKey.status), `Internal events accepted without key: ${noKey.status}`);
  console.log('PASS: cross-user project/task/feed isolation; task write rejected; internal event authorization');
} finally {
  if (session) await call(auth, '/auth/logout', session, 'POST');
  if (ownerSession) await call(auth, '/auth/logout', ownerSession, 'POST');
  if (ownerTask) {
    await pool.query('DELETE FROM tasks.tasks WHERE id=$1', [ownerTask]);
    const redis = createClient({ url: process.env.REDIS_URL });
    await redis.connect();
    try {
      const feed = 'taskflow:notifications:user:11111111-1111-4111-8111-111111111111';
      for (const entry of await redis.lRange(feed, 0, -1)) {
        const event = JSON.parse(entry);
        if (event.taskId === ownerTask) {
          await redis.lRem(feed, 1, entry);
          await redis.del(`taskflow:notifications:event:${event.id}`);
        }
      }
    } finally { await redis.close(); }
  }
  await pool.query('DELETE FROM auth.users WHERE id=$1', [userId]);
  await pool.end();
}
