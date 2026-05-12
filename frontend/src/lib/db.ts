import { Pool } from "pg";
import type { TrackedBet } from "./data";

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
  await pool().query(`
    ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free'
  `);
  await pool().query(`
    CREATE TABLE IF NOT EXISTS odds_cache (
      cache_key   TEXT        PRIMARY KEY,
      payload     JSONB       NOT NULL,
      fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool().query(`
    CREATE TABLE IF NOT EXISTS tracked_bets (
      id          TEXT        PRIMARY KEY,
      user_id     UUID        NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      game_id     TEXT        NOT NULL,
      matchup     TEXT        NOT NULL,
      pick        TEXT        NOT NULL,
      bet_type    TEXT        NOT NULL,
      odds        TEXT        NOT NULL,
      edge        REAL        NOT NULL,
      stake       REAL        NOT NULL DEFAULT 1,
      league      TEXT        NOT NULL,
      tracked_at  TIMESTAMPTZ NOT NULL,
      result      TEXT        NOT NULL DEFAULT 'pending',
      created_at  TIMESTAMPTZ DEFAULT now()
    )
  `);
  await pool().query(`
    ALTER TABLE tracked_bets ADD COLUMN IF NOT EXISTS game_date TIMESTAMPTZ
  `);
  _schemaReady = true;
}

// ─── Users ────────────────────────────────────────────────────────────────────

interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  plan: string;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  await ensureSchema();
  const { rows } = await pool().query<UserRow>(
    "SELECT id, email, name, password_hash, plan FROM auth_users WHERE email = $1",
    [email],
  );
  return rows[0] ?? null;
}

export async function createUser(
  email: string,
  name: string,
  passwordHash: string,
): Promise<{ id: string; email: string; name: string; plan: string }> {
  await ensureSchema();
  const { rows } = await pool().query<{ id: string; email: string; name: string; plan: string }>(
    "INSERT INTO auth_users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name, plan",
    [email, name, passwordHash],
  );
  return rows[0];
}

export async function getUserPlan(userId: string): Promise<string> {
  await ensureSchema();
  const { rows } = await pool().query<{ plan: string }>(
    "SELECT plan FROM auth_users WHERE id = $1",
    [userId],
  );
  return rows[0]?.plan ?? "free";
}

export async function updateUserPlan(userId: string, plan: string): Promise<void> {
  await ensureSchema();
  await pool().query("UPDATE auth_users SET plan = $1 WHERE id = $2", [plan, userId]);
}

export async function updateUserPassword(userId: string, passwordHash: string): Promise<void> {
  await ensureSchema();
  await pool().query("UPDATE auth_users SET password_hash = $1 WHERE id = $2", [passwordHash, userId]);
}

// ─── Tracked bets ─────────────────────────────────────────────────────────────

export async function getTrackedBets(userId: string): Promise<TrackedBet[]> {
  await ensureSchema();
  const { rows } = await pool().query<{
    id: string; game_id: string; matchup: string; pick: string;
    bet_type: string; odds: string; edge: number; stake: number;
    league: string; tracked_at: string; game_date: string | null; result: string;
  }>(
    "SELECT id, game_id, matchup, pick, bet_type, odds, edge, stake, league, tracked_at, game_date, result FROM tracked_bets WHERE user_id = $1 ORDER BY tracked_at DESC",
    [userId],
  );
  return rows.map((r) => ({
    id: r.id,
    gameId: r.game_id,
    matchup: r.matchup,
    pick: r.pick,
    betType: r.bet_type,
    odds: r.odds,
    edge: r.edge,
    stake: r.stake,
    league: r.league,
    trackedAt: r.tracked_at,
    gameDate: r.game_date ?? undefined,
    result: r.result as TrackedBet["result"],
  }));
}

export async function addTrackedBet(userId: string, bet: TrackedBet): Promise<void> {
  await ensureSchema();
  await pool().query(
    `INSERT INTO tracked_bets (id, user_id, game_id, matchup, pick, bet_type, odds, edge, stake, league, tracked_at, game_date, result)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (id) DO NOTHING`,
    [bet.id, userId, bet.gameId, bet.matchup, bet.pick, bet.betType, bet.odds, bet.edge, bet.stake, bet.league, bet.trackedAt, bet.gameDate ?? null, bet.result],
  );
}

export async function updateTrackedBetResult(
  userId: string,
  id: string,
  result: TrackedBet["result"],
): Promise<void> {
  await ensureSchema();
  await pool().query(
    "UPDATE tracked_bets SET result = $1 WHERE id = $2 AND user_id = $3",
    [result, id, userId],
  );
}

export async function deleteTrackedBet(userId: string, id: string): Promise<void> {
  await ensureSchema();
  await pool().query(
    "DELETE FROM tracked_bets WHERE id = $1 AND user_id = $2",
    [id, userId],
  );
}

export async function getAllUsers(): Promise<{ id: string; email: string; name: string; plan: string }[]> {
  await ensureSchema();
  const { rows } = await pool().query<{ id: string; email: string; name: string; plan: string }>(
    "SELECT id, email, name, plan FROM auth_users ORDER BY created_at DESC",
  );
  return rows;
}

// ─── Odds cache ───────────────────────────────────────────────────────────────

export async function getOddsCache(
  key: string,
): Promise<{ payload: unknown; fetchedAt: Date } | null> {
  try {
    await ensureSchema();
    const { rows } = await pool().query<{ payload: unknown; fetched_at: Date }>(
      "SELECT payload, fetched_at FROM odds_cache WHERE cache_key = $1",
      [key],
    );
    if (!rows[0]) return null;
    return { payload: rows[0].payload, fetchedAt: rows[0].fetched_at };
  } catch {
    return null;
  }
}

export async function setOddsCache(key: string, payload: unknown): Promise<void> {
  try {
    await ensureSchema();
    await pool().query(
      `INSERT INTO odds_cache (cache_key, payload, fetched_at)
       VALUES ($1, $2, now())
       ON CONFLICT (cache_key) DO UPDATE SET payload = $2, fetched_at = now()`,
      [key, JSON.stringify(payload)],
    );
  } catch {
    // Non-critical — in-memory cache still works
  }
}
