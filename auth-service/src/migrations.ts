import type pg from 'pg';

const migrations = [
  { version: 1, name: 'create_users', sql: `
    CREATE TABLE IF NOT EXISTS auth.users (
      id UUID PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(254) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )` },
  { version: 2, name: 'unique_normalized_email', sql: `
    CREATE UNIQUE INDEX IF NOT EXISTS users_normalized_email ON auth.users (lower(email))` },
];

export async function migrate(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialize startup across replicas, including the first migration-table creation.
    await client.query('SELECT pg_advisory_xact_lock($1)', [74190813]);
    await client.query(`CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.schema_migrations (
        version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    const applied = await client.query<{ version: number }>('SELECT version FROM auth.schema_migrations');
    const versions = new Set(applied.rows.map(row => row.version));
    for (const migration of migrations) {
      if (versions.has(migration.version)) continue;
      await client.query(migration.sql);
      await client.query('INSERT INTO auth.schema_migrations (version,name) VALUES ($1,$2)',
        [migration.version, migration.name]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
