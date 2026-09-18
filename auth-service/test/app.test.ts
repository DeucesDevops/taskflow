import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { hashPassword, verifyPassword } from '../src/password.js';
import type { Store, User } from '../src/store.js';

async function fixture() {
  const user = { id: '11111111-1111-4111-8111-111111111111', name: 'Alex', email: 'alex@example.test' };
  const passwordHash = await hashPassword('correct-password');
  const sessions = new Map<string, User>();
  const store: Store = {
    findUser: async email => email === user.email ? { ...user, passwordHash } : undefined,
    saveSession: async (token, value) => { sessions.set(token, value); },
    getSession: async token => sessions.get(token) ?? null,
    deleteSession: async token => { sessions.delete(token); },
    allowLogin: async () => true,
    ready: async () => {},
  };
  return { app: await createApp(store, false), store };
}

test('login, session lookup and logout revoke access without exposing password hash', async t => {
  const { app } = await fixture(); t.after(() => app.close());
  const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'Alex@example.test', password: 'correct-password' } });
  assert.equal(login.statusCode, 200);
  const { token, user } = login.json();
  assert.match(token, /^[a-f0-9]{64}$/);
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
});
test('password hashing salts values and rejects malformed hashes', async () => {
  assert.notEqual(await hashPassword('example'), await hashPassword('example'));
  assert.equal(await verifyPassword('example', 'invalid'), false);
});
