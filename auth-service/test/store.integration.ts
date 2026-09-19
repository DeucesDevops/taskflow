import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';
import { createClient } from 'redis';
import { createApp } from '../src/app.js';
import { hashPassword, verifyPassword } from '../src/password.js';
import { connectStore } from '../src/store.js';

// Use a PostgreSQL role with CREATE DATABASE and a dedicated test Redis instance.
// A uniquely named temporary database is always used; the configured DB is untouched.
const databaseUrl = process.env.AUTH_TEST_DATABASE_URL;
const redisUrl = process.env.AUTH_TEST_REDIS_URL;

test('real PostgreSQL upgrade preserves users; registration uniqueness and Redis revocation persist', {
  skip: !databaseUrl || !redisUrl ? 'Set AUTH_TEST_DATABASE_URL and AUTH_TEST_REDIS_URL' : false,
}, async t => {
  const databaseName = `auth_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Pool({ connectionString: databaseUrl });
  await admin.query(`CREATE DATABASE ${databaseName}`);
  const isolatedUrl = new URL(databaseUrl!);
  isolatedUrl.pathname = `/${databaseName}`;
  const database = new pg.Pool({ connectionString: isolatedUrl.toString() });
  const redis = createClient({ url: redisUrl });
  await redis.connect();
  let resources: Awaited<ReturnType<typeof connectStore>> | undefined;
  let app: Awaited<ReturnType<typeof createApp>> | undefined;
  t.after(async () => {
    await app?.close();
    await resources?.close();
    await database.end();
    await redis.close();
    await admin.query(`DROP DATABASE ${databaseName}`);
    await admin.end();
  });

  // Match the unversioned Milestone 1 schema, including an edited demo account.
  await database.query(`CREATE SCHEMA auth;
    CREATE TABLE auth.users (
      id UUID PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(254) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  const existing = { id: '11111111-1111-4111-8111-111111111111', name: 'Edited name',
    email: 'edited@example.test', passwordHash: await hashPassword('edited-password') };
  await database.query('INSERT INTO auth.users (id,name,email,password_hash) VALUES ($1,$2,$3,$4)',
    [existing.id, existing.name, existing.email, existing.passwordHash]);
  const config = { databaseUrl: isolatedUrl.toString(), redisUrl: redisUrl!,
    demoEmail: 'bootstrap@example.test', demoPassword: 'new-bootstrap-password' };
  resources = await connectStore(config);
  assert.deepEqual(await resources.store.findUser(existing.email), existing);
  assert.equal(await resources.store.findUser(config.demoEmail), undefined);
  assert.deepEqual((await database.query('SELECT version FROM auth.schema_migrations ORDER BY version')).rows,
    [{ version: 1 }, { version: 2 }]);
  app = await createApp(resources.store, { jwtSecret: 'integration-secret-at-least-thirty-two-bytes', logger: false });

  const registrations = await Promise.all(['Jamie@example.test', 'jamie@EXAMPLE.test'].map(email => app!.inject({
    method: 'POST', url: '/auth/register', payload: { name: 'Jamie', email, password: 'new-user-password' },
  })));
  assert.deepEqual(registrations.map(response => response.statusCode).sort(), [201, 409]);
  const { token, user } = registrations.find(response => response.statusCode === 201)!.json();
  const stored = await resources.store.findUser(user.email);
  assert.equal(await verifyPassword('new-user-password', stored!.passwordHash), true);
  assert.equal((await database.query('SELECT count(*)::int AS count FROM auth.users')).rows[0].count, 2);
  const sessionKey = `auth:session:${createHash('sha256').update(token).digest('hex')}`;
  const ttl = await redis.ttl(sessionKey);
  assert.ok(ttl > 86390 && ttl <= 86400);
  const headers = { authorization: `Bearer ${token}` };
  assert.equal((await app.inject({ url: '/auth/me', headers })).statusCode, 200);
  assert.equal((await app.inject({ method: 'POST', url: '/auth/logout', headers })).statusCode, 204);
  assert.equal(await redis.get(sessionKey), null);
  assert.equal((await app.inject({ url: '/auth/me', headers })).statusCode, 401);

  // Startup migrations and seed are repeatable without overwriting account changes.
  await resources.close();
  resources = undefined;
  resources = await connectStore(config);
  assert.deepEqual(await resources.store.findUser(existing.email), existing);
  assert.equal((await database.query('SELECT count(*)::int AS count FROM auth.schema_migrations')).rows[0].count, 2);
  assert.equal((await resources.store.findUser(user.email))?.id, user.id);
});
