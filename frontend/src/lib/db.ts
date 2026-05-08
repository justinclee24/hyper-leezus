import { Pool } from "pg";

let _pool: Pool | null = null;
let _schemaReady = false;

function pool(): Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.POSTGRES_DSN,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    });
  }
  return _pool;
}

async function ensureSchema(): Promise<void> {
  if (_schemaReady) return;
  await pool().query(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      email         TEXT        UNIQUE NOT NULL,
      name          TEXT        NOT NULL,
      password_hash TEXT        NOT NULL,
      created_at    TIMESTAMPTZ DEFAULT now()
    )
  `);
  _schemaReady = true;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  await ensureSchema();
  const { rows } = await pool().query<UserRow>(
    "SELECT id, email, name, password_hash FROM auth_users WHERE email = $1",
    [email],
  );
  return rows[0] ?? null;
}

export async function createUser(
  email: string,
  name: string,
  passwordHash: string,
): Promise<{ id: string; email: string; name: string }> {
  await ensureSchema();
  const { rows } = await pool().query<{ id: string; email: string; name: string }>(
    "INSERT INTO auth_users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name",
    [email, name, passwordHash],
  );
  return rows[0];
}
