import { randomBytes } from 'node:crypto';
import Fastify from 'fastify';
import { hashPassword, verifyPassword } from './password.js';
import type { Store } from './store.js';

const bearer = (header: string | undefined): string | null => {
  const match = /^Bearer ([a-f0-9]{64})$/.exec(header ?? '');
  return match?.[1] ?? null;
};

export async function createApp(store: Store, logger = true) {
  const app = Fastify({ logger: logger ? { level: process.env.LOG_LEVEL ?? 'info',
    redact: ['req.headers.authorization', 'req.headers.cookie'] } : false,
    bodyLimit: 16384, requestTimeout: 10000 });
  const dummyHash = await hashPassword(randomBytes(32).toString('hex'));
  app.setErrorHandler((error, request, reply) => {
    const e = error as Error & { validation?: unknown; statusCode?: number };
    if (e.validation || (e.statusCode && e.statusCode >= 400 && e.statusCode < 500)) {
      return reply.code(e.statusCode ?? 400).send({ error: 'Invalid request' });
    }
    request.log.error({ err: error }, 'Request failed');
    return reply.code(503).send({ error: 'Authentication service temporarily unavailable' });
  });
  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: 'Not found' }));
  app.get('/health', async () => ({ status: 'ok', service: 'auth-service' }));
  app.get('/ready', async () => { await store.ready(); return { status: 'ok', service: 'auth-service' }; });
  app.post<{ Body: { email: string; password: string } }>('/auth/login', {
    schema: { body: { type: 'object', required: ['email', 'password'], additionalProperties: false,
      properties: { email: { type: 'string', minLength: 3, maxLength: 254 },
        password: { type: 'string', minLength: 1, maxLength: 256 } } } },
  }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    if (!(await store.allowLogin(request.ip))) {
      return reply.code(429).header('Retry-After', '60').send({ error: 'Too many sign-in attempts. Try again in a minute.' });
    }
    const user = await store.findUser(request.body.email.trim().toLowerCase());
    const matches = await verifyPassword(request.body.password, user?.passwordHash ?? dummyHash);
    if (!user || !matches) return reply.code(401).send({ error: 'Incorrect email or password' });
    const publicUser = { id: user.id, name: user.name, email: user.email };
    const token = randomBytes(32).toString('hex');
    await store.saveSession(token, publicUser);
    return { token, user: publicUser };
  });
  app.get('/auth/me', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const token = bearer(request.headers.authorization);
    const user = token ? await store.getSession(token) : null;
    if (!user) return reply.code(401).send({ error: 'Sign in to continue' });
    return { user };
  });
  app.post('/auth/logout', async (request, reply) => {
    const token = bearer(request.headers.authorization);
    if (token) await store.deleteSession(token);
    return reply.code(204).send();
  });
  return app;
}
