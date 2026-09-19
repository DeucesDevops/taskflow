import { randomBytes } from 'node:crypto';
import Fastify from 'fastify';
import { hashPassword, verifyPassword } from './password.js';
import type { Store, User } from './store.js';
import { createTokens } from './token.js';

const bearer = (header: string | undefined): string | null => {
  const match = /^Bearer ([A-Za-z0-9_.-]{1,512})$/i.exec(header ?? '');
  return match?.[1] ?? null;
};
const emailSchema = { type: 'string', minLength: 3, maxLength: 254,
  pattern: '^\\s*[^\\s@]+@[^\\s@]+\\.[^\\s@]+\\s*$' };
const publicUser = (user: User): User => ({ id: user.id, name: user.name, email: user.email });

export async function createApp(store: Store, options: { jwtSecret: string; logger?: boolean }) {
  const { logger = true } = options;
  const tokens = createTokens(options.jwtSecret);
  const app = Fastify({ logger: logger ? { level: process.env.LOG_LEVEL ?? 'info',
    redact: ['req.headers.authorization', 'req.headers.cookie'] } : false,
    bodyLimit: 16384, requestTimeout: 10000 });
  const dummyHash = await hashPassword(randomBytes(32).toString('hex'));
  async function authenticate(header: string | undefined): Promise<User | null> {
    const token = bearer(header);
    if (!token) return null;
    // Existing opaque sessions retain their original Redis TTL during the upgrade.
    if (/^[a-f0-9]{64}$/.test(token)) return store.getSession(token);
    const subject = await tokens.subject(token);
    if (!subject) return null;
    const user = await store.getSession(token);
    return user?.id === subject ? user : null;
  }
  async function signIn(user: User) {
    const safeUser = publicUser(user);
    const token = await tokens.sign(user.id);
    await store.saveSession(token, safeUser);
    return { token, user: safeUser };
  }
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
      properties: { email: emailSchema,
        password: { type: 'string', minLength: 1, maxLength: 256 } } } },
  }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    if (!(await store.allowLogin(request.ip))) {
      return reply.code(429).header('Retry-After', '60').send({ error: 'Too many sign-in attempts. Try again in a minute.' });
    }
    const user = await store.findUser(request.body.email.trim().toLowerCase());
    const matches = await verifyPassword(request.body.password, user?.passwordHash ?? dummyHash);
    if (!user || !matches) return reply.code(401).send({ error: 'Incorrect email or password' });
    return signIn(user);
  });
  app.post<{ Body: { name: string; email: string; password: string } }>('/auth/register', {
    schema: { body: { type: 'object', required: ['name', 'email', 'password'], additionalProperties: false,
      properties: { name: { type: 'string', minLength: 1, maxLength: 100, pattern: '\\S' },
        email: emailSchema, password: { type: 'string', minLength: 8, maxLength: 256 } } } },
  }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    if (!(await store.allowLogin(request.ip))) {
      return reply.code(429).header('Retry-After', '60').send({ error: 'Too many sign-up attempts. Try again in a minute.' });
    }
    const user = await store.createUser({ name: request.body.name.trim(),
      email: request.body.email.trim().toLowerCase(), passwordHash: await hashPassword(request.body.password) });
    if (!user) return reply.code(409).send({ error: 'An account with this email already exists' });
    const session = await signIn(user);
    return reply.code(201).send(session);
  });
  app.get('/auth/me', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const user = await authenticate(request.headers.authorization);
    if (!user) return reply.code(401).send({ error: 'Sign in to continue' });
    return { user: publicUser(user) };
  });
  app.get<{ Querystring: { email: string } }>('/auth/users', {
    schema: { querystring: { type: 'object', required: ['email'], additionalProperties: false,
      properties: { email: emailSchema } } },
  }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    if (!(await authenticate(request.headers.authorization))) {
      return reply.code(401).send({ error: 'Sign in to continue' });
    }
    const user = await store.findUser(request.query.email.trim().toLowerCase());
    return user ? { user: publicUser(user) } : reply.code(404).send({ error: 'User not found' });
  });
  app.get<{ Params: { id: string } }>('/auth/users/:id', {
    schema: { params: { type: 'object', required: ['id'],
      properties: { id: { type: 'string', format: 'uuid' } } } },
  }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    if (!(await authenticate(request.headers.authorization))) {
      return reply.code(401).send({ error: 'Sign in to continue' });
    }
    const user = await store.findUserById(request.params.id);
    return user ? { user: publicUser(user) } : reply.code(404).send({ error: 'User not found' });
  });
  app.post('/auth/logout', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const token = bearer(request.headers.authorization);
    if (token) await store.deleteSession(token);
    return reply.code(204).send();
  });
  return app;
}
