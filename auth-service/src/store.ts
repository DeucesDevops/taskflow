import { createHash } from 'node:crypto';
import pg from 'pg';
import { createClient } from 'redis';
import { hashPassword } from './password.js';

export type User = { id: string; name: string; email: string };
export type StoredUser = User & { passwordHash: string };
export interface Store {
  findUser(email: string): Promise<StoredUser | undefined>;
  saveSession(token: string, user: User): Promise<void>;
  getSession(token: string): Promise<User | null>;
  deleteSession(token: string): Promise<void>;
  allowLogin(ip: string): Promise<boolean>;
  ready(): Promise<void>;
}
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const sessionKey = (token: string) => `auth:session:${digest(token)}`;

export async function connectStore(config: {
  databaseUrl: string; redisUrl: string; demoEmail: string; demoPassword: string;
}) {
  const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 5,
    connectionTimeoutMillis: 3000, query_timeout: 3000, statement_timeout: 3000 });
  const redis = createClient({ url: config.redisUrl, disableOfflineQueue: true,
    commandsQueueMaxLength: 1000, commandOptions: { timeout: 3000 },
    socket: { connectTimeout: 3000, reconnectStrategy: retries => Math.min(100 * 2 ** retries, 3000) } });
  redis.on('error', () => console.error('Redis connection unavailable'));
  pool.on('error', () => console.error('PostgreSQL connection unavailable'));
  await redis.connect();
  await pool.query(`CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.users (
      id UUID PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(254) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await pool.query(`INSERT INTO auth.users (id,name,email,password_hash)
    VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE
    SET name=excluded.name,email=excluded.email,password_hash=excluded.password_hash`,
    ['11111111-1111-4111-8111-111111111111', 'Alex Morgan', config.demoEmail.toLowerCase(), await hashPassword(config.demoPassword)]);

  const store: Store = {
    async findUser(email) {
      const result = await pool.query<StoredUser>(
        'SELECT id,name,email,password_hash AS "passwordHash" FROM auth.users WHERE email=$1', [email]);
      return result.rows[0];
    },
    async saveSession(token, user) { await redis.set(sessionKey(token), JSON.stringify(user), { EX: 86400 }); },
    async getSession(token) {
      const value = await redis.get(sessionKey(token));
      return value ? JSON.parse(value) as User : null;
    },
    async deleteSession(token) { await redis.del(sessionKey(token)); },
    async allowLogin(ip) {
      // Atomic fixed-window rate limit shared by replicas; no raw IP stored in Redis.
      const key = `auth:login:${digest(ip)}:${Math.floor(Date.now() / 60000)}`;
      const count = await redis.eval(
        "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],120) end; return n",
        { keys: [key], arguments: [] });
      return Number(count) <= 10;
    },
    async ready() { await Promise.all([pool.query('SELECT 1'), redis.ping()]); },
  };
  return { store, close: async () => { await Promise.all([pool.end(), redis.close()]); } };
}
