import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { SignJWT, decodeJwt } from 'jose';
import { createApp } from '../src/app.js';
import { hashPassword, verifyPassword } from '../src/password.js';
import { createTokens } from '../src/token.js';
import type { Store, StoredUser, User } from '../src/store.js';

const jwtSecret = 'test-only-secret-with-at-least-thirty-two-bytes';

async function fixture() {
  const user = { id: '11111111-1111-4111-8111-111111111111', name: 'Alex', email: 'alex@example.test' };
  const passwordHash = await hashPassword('correct-password');
  const users = new Map<string, StoredUser>([[user.email, { ...user, passwordHash }]]);
  const sessions = new Map<string, User>();
  const store: Store = {
    findUser: async email => users.get(email),
    findUserById: async id => [...users.values()].find(value => value.id === id),
    createUser: async input => {
      if (users.has(input.email)) return undefined;
      const created = { ...input, id: randomUUID() };
      users.set(input.email, created);
      return created;
    },
    saveSession: async (token, value) => { sessions.set(token, value); },
    getSession: async token => sessions.get(token) ?? null,
    deleteSession: async token => { sessions.delete(token); },
    allowLogin: async () => true,
    ready: async () => {},
  };
  return { app: await createApp(store, { logger: false, jwtSecret }), store, users, sessions, user };
}

test('login, session lookup and logout revoke access without exposing password hash', async t => {
  const { app } = await fixture(); t.after(() => app.close());
  const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'Alex@example.test', password: 'correct-password' } });
  assert.equal(login.statusCode, 200);
  const { token, user } = login.json();
  assert.match(token, /^[\w-]+\.[\w-]+\.[\w-]+$/);
  assert.ok(token.length <= 512);
  const claims = decodeJwt(token);
  assert.equal(claims.sub, user.id);
  assert.equal(claims.exp! - claims.iat!, 86400);
  assert.equal(user.passwordHash, undefined);
  const headers = { authorization: `Bearer ${token}` };
  assert.equal((await app.inject({ url: '/auth/me', headers })).statusCode, 200);
  assert.equal((await app.inject({ method: 'POST', url: '/auth/logout', headers })).statusCode, 204);
  assert.equal((await app.inject({ url: '/auth/me', headers })).statusCode, 401);
});
test('unknown user and wrong password both reject with the same response', async t => {
  const { app } = await fixture(); t.after(() => app.close());
  for (const email of ['nobody@example.test', 'alex@example.test']) {
    const response = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: 'wrong-password' } });
    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.json(), { error: 'Incorrect email or password' });
  }
  assert.equal((await app.inject({ method: 'POST', url: '/auth/login', payload: {} })).statusCode, 400);
});
test('dependency outage is 503 while liveness stays healthy', async t => {
  const { app, store } = await fixture(); t.after(() => app.close());
  store.ready = async () => { throw new Error('private connection information'); };
  const ready = await app.inject('/ready');
  assert.equal(ready.statusCode, 503);
  assert.ok(!ready.body.includes('private'));
  assert.equal((await app.inject('/health')).statusCode, 200);
});
test('rate limit rejects further attempts', async t => {
  const { app, store } = await fixture(); t.after(() => app.close());
  store.allowLogin = async () => false;
  const response = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'alex@example.test', password: 'correct-password' } });
  assert.equal(response.statusCode, 429);
  const registration = await app.inject({ method: 'POST', url: '/auth/register',
    payload: { name: 'New', email: 'new@example.test', password: 'correct-password' } });
  assert.equal(registration.statusCode, 429);
  assert.equal(registration.headers['retry-after'], '60');
});
test('password hashing salts values and rejects malformed hashes', async () => {
  assert.notEqual(await hashPassword('example'), await hashPassword('example'));
  assert.equal(await verifyPassword('example', 'invalid'), false);
});

test('registration normalizes email/name, salts passwords, signs in, and prevents duplicates', async t => {
  const { app, users } = await fixture(); t.after(() => app.close());
  const payload = { name: '  Jamie Taylor  ', email: '  Jamie@Example.Test ', password: 'correct-password' };
  const response = await app.inject({ method: 'POST', url: '/auth/register', payload });
  assert.equal(response.statusCode, 201);
  assert.equal(response.headers['cache-control'], 'no-store');
  const { token, user } = response.json();
  assert.equal(user.name, 'Jamie Taylor');
  assert.equal(user.email, 'jamie@example.test');
  assert.equal(user.passwordHash, undefined);
  assert.equal(user.password, undefined);
  const persisted = users.get(user.email)!;
  assert.notEqual(persisted.passwordHash, payload.password);
  assert.notEqual(persisted.passwordHash, users.get('alex@example.test')!.passwordHash);
  assert.equal(await verifyPassword(payload.password, persisted.passwordHash), true);
  assert.equal((await app.inject({ url: '/auth/me', headers: { authorization: `Bearer ${token}` } })).statusCode, 200);
  const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: user.email, password: payload.password } });
  assert.equal(login.statusCode, 200);
  assert.notEqual(login.json().token, token);
  const duplicate = await app.inject({ method: 'POST', url: '/auth/register', payload: { ...payload, email: user.email } });
  assert.equal(duplicate.statusCode, 409);
  assert.equal(users.size, 2);
});

test('registration validates required values and length before creating a user', async t => {
  const { app, users } = await fixture(); t.after(() => app.close());
  const valid = { name: 'Jamie', email: 'jamie@example.test', password: 'correct-password' };
  for (const payload of [{}, { ...valid, name: '   ' }, { ...valid, name: 'x'.repeat(101) },
    { ...valid, email: 'not-an-email' }, { ...valid, email: 'person@' },
    { ...valid, email: `${'x'.repeat(250)}@example.test` },
    { ...valid, password: 'short' }, { ...valid, password: 'x'.repeat(257) }]) {
    assert.equal((await app.inject({ method: 'POST', url: '/auth/register', payload })).statusCode, 400);
  }
  assert.equal(users.size, 1);
});

test('JWT validation rejects tampering, expired claims, wrong audience and subject/session mismatch', async t => {
  const { app, store, user } = await fixture(); t.after(() => app.close());
  const valid = await createTokens(jwtSecret).sign(user.id);
  const [header, payload, signature] = valid.split('.');
  const changedPayload = Buffer.from(JSON.stringify({ ...decodeJwt(valid), sub: randomUUID() })).toString('base64url');
  const signed = async (options: { audience?: string; subject?: string; expiration?: number; issuedAt?: number; algorithm?: string }) =>
    new SignJWT({}).setProtectedHeader({ alg: options.algorithm ?? 'HS256', typ: 'JWT' })
      .setSubject(options.subject ?? user.id).setJti(randomUUID()).setIssuer('taskflow-auth')
      .setAudience(options.audience ?? 'taskflow').setIssuedAt(options.issuedAt ?? Math.floor(Date.now() / 1000))
      .setExpirationTime(options.expiration ?? Math.floor(Date.now() / 1000) + 86400)
      .sign(new TextEncoder().encode(jwtSecret));
  const invalidTokens = [
    `${header}.${changedPayload}.${signature}`,
    `${header}.${payload}.${signature!.startsWith('a') ? 'b' : 'a'}${signature!.slice(1)}`,
    await signed({ expiration: Math.floor(Date.now() / 1000) - 1 }),
    await signed({ audience: 'another-app' }),
    await signed({ subject: randomUUID() }),
    await signed({ issuedAt: Math.floor(Date.now() / 1000) + 3600 }),
    await signed({ algorithm: 'HS384' }),
  ];
  for (const token of invalidTokens) {
    // Even an existing session cannot make invalid JWT claims or signatures valid.
    await store.saveSession(token, user);
    assert.equal((await app.inject({ url: '/auth/me', headers: { authorization: `Bearer ${token}` } })).statusCode, 401);
  }
  assert.equal((await app.inject({ url: '/auth/me' })).statusCode, 401);
  assert.equal((await app.inject({ url: '/auth/me', headers: { authorization: `Bearer ${valid}` } })).statusCode, 401);
});

test('existing opaque sessions remain usable and revocable until Redis expiry', async t => {
  const { app, store, user } = await fixture(); t.after(() => app.close());
  const token = 'a'.repeat(64);
  await store.saveSession(token, user);
  const headers = { authorization: `Bearer ${token}` };
  assert.equal((await app.inject({ url: '/auth/me', headers })).statusCode, 200);
  assert.equal((await app.inject({ method: 'POST', url: '/auth/logout', headers })).statusCode, 204);
  assert.equal((await app.inject({ url: '/auth/me', headers })).statusCode, 401);
});

test('member lookups require authentication and return public profiles by email or ID', async t => {
  const { app, user } = await fixture(); t.after(() => app.close());
  const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: user.email, password: 'correct-password' } });
  const headers = { authorization: `Bearer ${login.json().token}` };
  for (const url of [`/auth/users?email=${user.email.toUpperCase()}`, `/auth/users/${user.id}`]) {
    assert.equal((await app.inject({ url })).statusCode, 401);
    const response = await app.inject({ url, headers });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { user });
  }
  for (const url of ['/auth/users?email=missing@example.test', `/auth/users/${randomUUID()}`]) {
    assert.equal((await app.inject({ url, headers })).statusCode, 404);
  }
  assert.equal((await app.inject({ url: '/auth/users/not-a-uuid', headers })).statusCode, 400);
});

test('database and session outages fail closed with safe 503 responses', async t => {
  const { app, store, user } = await fixture(); t.after(() => app.close());
  const token = await createTokens(jwtSecret).sign(user.id);
  const unavailable = async (): Promise<never> => { throw new Error('private connection information'); };
  store.createUser = unavailable;
  store.findUser = unavailable;
  store.getSession = unavailable;
  store.deleteSession = unavailable;
  const responses = [
    await app.inject({ method: 'POST', url: '/auth/register', payload: { name: 'New', email: 'new@example.test', password: 'correct-password' } }),
    await app.inject({ method: 'POST', url: '/auth/login', payload: { email: user.email, password: 'correct-password' } }),
    await app.inject({ url: '/auth/me', headers: { authorization: `Bearer ${token}` } }),
    await app.inject({ method: 'POST', url: '/auth/logout', headers: { authorization: `Bearer ${token}` } }),
  ];
  for (const response of responses) {
    assert.equal(response.statusCode, 503);
    assert.ok(!response.body.includes('private'));
  }
});

test('unsafe JWT secrets are rejected during startup', async () => {
  assert.throws(() => createTokens(''), /JWT_SECRET/);
  assert.throws(() => createTokens('x'.repeat(31)), /JWT_SECRET/);
});
