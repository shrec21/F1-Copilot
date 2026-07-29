import Database from 'better-sqlite3';
import { join } from 'path';

// __dirname is CJS-only.
// DB_PATH is read lazily (inside initDb) so that tests can override
// process.env.DB_PATH before calling initDb().
let _db: InstanceType<typeof Database> | null = null;

function getDbPath(): string {
  return process.env.DB_PATH ?? join(__dirname, '../../data.db');
}

/**
 * Returns the database singleton. Throws if initDb() has not been called yet.
 */
export function getDb(): InstanceType<typeof Database> {
  if (!_db) throw new Error('Database not initialised. Call initDb() first.');
  return _db;
}

/**
 * Lazy accessor used by queries.ts. Matches the brief's `db` export contract
 * through a Proxy so existing `db.prepare(...)` calls work unchanged.
 */
export const db: InstanceType<typeof Database> = new Proxy({} as InstanceType<typeof Database>, {
  get(_target, prop) {
    return getDb()[prop as keyof InstanceType<typeof Database>];
  },
});

// TODO: Authentication required before public deployment.
// This is single-user MVP only. Add session auth before exposing to multiple users.
export function initDb(): void {
  if (!_db) {
    _db = new Database(getDbPath());
  }

  _db.exec(`
    CREATE TABLE IF NOT EXISTS user_profile (
      id          INTEGER PRIMARY KEY CHECK (id = 1),  -- single-user: only row id=1
      full_name   TEXT NOT NULL,
      program_end_date   TEXT NOT NULL,  -- ISO 8601
      degree_level       TEXT NOT NULL,  -- e.g. "masters", "phd", "bachelors"
      visa_admission_type TEXT NOT NULL, -- "D/S" or "fixed-date"
      admission_date      TEXT NOT NULL, -- ISO 8601, most recent I-94
      is_stem_eligible   INTEGER NOT NULL DEFAULT 0  -- 0/1 boolean
    );

    CREATE TABLE IF NOT EXISTS employment_periods (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      employer    TEXT NOT NULL,
      auth_type   TEXT NOT NULL,  -- 'CPT' | 'OPT' | 'STEM-OPT'
      cpt_type    TEXT,           -- 'full-time' | 'part-time' | NULL
      hours_per_week INTEGER NOT NULL,
      start_date  TEXT NOT NULL,  -- ISO 8601
      end_date    TEXT            -- ISO 8601 | NULL (currently employed)
    );

    CREATE TABLE IF NOT EXISTS authorizations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      auth_type   TEXT NOT NULL,  -- 'CPT' | 'OPT' | 'STEM-OPT'
      employer    TEXT,           -- required for CPT, NULL for OPT/STEM-OPT
      start_date  TEXT NOT NULL,
      end_date    TEXT NOT NULL
    );
  `);
}
