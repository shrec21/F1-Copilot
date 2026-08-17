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

    CREATE TABLE IF NOT EXISTS action_step_completions (
      step_id      TEXT PRIMARY KEY,
      completed    INTEGER NOT NULL DEFAULT 0,  -- 0/1 boolean
      completed_at TEXT                         -- ISO 8601 | NULL
    );

    CREATE TABLE IF NOT EXISTS document_statuses (
      doc_id      TEXT PRIMARY KEY,
      status      TEXT NOT NULL DEFAULT 'not-started',  -- 'not-started'|'located'|'scanned'|'submitted'
      notes       TEXT,                                  -- free-text notes from the student
      updated_at  TEXT                                   -- ISO 8601 timestamp
    );

    -- Synthetic student cohort (separate from single-user user_profile).
    -- Populated by the seed generator; never contains real student data.
    CREATE TABLE IF NOT EXISTS students (
      id                  TEXT PRIMARY KEY,   -- UUID
      full_name           TEXT NOT NULL,
      sevis_id            TEXT NOT NULL UNIQUE,
      program_level       TEXT NOT NULL,      -- 'bachelors'|'masters'|'phd'|'other'
      major               TEXT NOT NULL,
      is_stem_designated  INTEGER NOT NULL DEFAULT 0,  -- 0/1
      program_start_date  TEXT NOT NULL,
      program_end_date    TEXT NOT NULL,
      admission_type      TEXT NOT NULL,      -- 'D/S'|'fixed-date'
      i94_admission_date  TEXT NOT NULL,
      i94_expiry_date     TEXT               -- NULL when admission_type is 'D/S'
    );

    -- Employment periods for synthetic students
    CREATE TABLE IF NOT EXISTS student_employment (
      id              TEXT PRIMARY KEY,
      student_id      TEXT NOT NULL REFERENCES students(id),
      auth_type       TEXT NOT NULL,      -- 'CPT'|'OPT'|'STEM-OPT'
      employer        TEXT NOT NULL,
      hours_per_week  INTEGER NOT NULL,
      start_date      TEXT NOT NULL,
      end_date        TEXT,               -- NULL = currently employed
      cpt_type        TEXT,              -- 'full-time'|'part-time'|NULL
      employer_everify_enrolled INTEGER  -- 0=no, 1=yes, NULL=unknown
    );

    -- Authorization periods for synthetic students
    CREATE TABLE IF NOT EXISTS student_authorizations (
      id          TEXT PRIMARY KEY,
      student_id  TEXT NOT NULL REFERENCES students(id),
      auth_type   TEXT NOT NULL,
      employer    TEXT,
      start_date  TEXT NOT NULL,
      end_date    TEXT NOT NULL
    );

    -- Transactional outbox: written in same transaction as the triggering state
    -- change. Guarantees at-least-once delivery if the process crashes mid-flight.
    CREATE TABLE IF NOT EXISTS outbox_events (
      id            TEXT PRIMARY KEY,     -- UUID
      type          TEXT NOT NULL,        -- ComplianceEventType
      student_id    TEXT NOT NULL,
      payload       TEXT NOT NULL,        -- JSON
      created_at    TEXT NOT NULL,        -- ISO 8601
      dispatched    INTEGER NOT NULL DEFAULT 0,
      dispatched_at TEXT                  -- ISO 8601, NULL until processed
    );

    -- Permanent log of dispatched events (source of truth for timeline)
    CREATE TABLE IF NOT EXISTS compliance_events (
      id          TEXT PRIMARY KEY,
      type        TEXT NOT NULL,
      student_id  TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      payload     TEXT NOT NULL           -- JSON
    );

    -- Immutable audit trail. One row per (event, rule) pair. Append-only.
    CREATE TABLE IF NOT EXISTS audit_trail (
      id              TEXT PRIMARY KEY,
      student_id      TEXT NOT NULL,
      event_id        TEXT NOT NULL REFERENCES compliance_events(id),
      rule_id         TEXT NOT NULL,
      rule_version    INTEGER NOT NULL,
      status          TEXT NOT NULL,      -- 'pass'|'warning'|'violation'|'not-applicable'
      inputs_json     TEXT NOT NULL,      -- snapshot of values used at evaluation
      outputs_json    TEXT NOT NULL,
      source_citation TEXT NOT NULL,
      message         TEXT NOT NULL,
      created_at      TEXT NOT NULL
    );

    -- STEM I-983 submission dates for synthetic students
    CREATE TABLE IF NOT EXISTS student_i983_submissions (
      id          TEXT PRIMARY KEY,
      student_id  TEXT NOT NULL REFERENCES students(id),
      submitted_at TEXT NOT NULL          -- ISO 8601 date
    );

    -- ── Regulation-change watcher ────────────────────────────────────────────
    -- One row per scheduled or manual check run.
    -- Append-only: proves the watcher is actually executing periodically.
    CREATE TABLE IF NOT EXISTS watcher_check_log (
      id              TEXT PRIMARY KEY,   -- UUID
      started_at      TEXT NOT NULL,      -- ISO 8601
      finished_at     TEXT,               -- NULL while in-progress
      sources_checked INTEGER NOT NULL DEFAULT 0,
      changes_found   INTEGER NOT NULL DEFAULT 0,
      tickets_created INTEGER NOT NULL DEFAULT 0,
      error           TEXT                -- populated if the run threw
    );

    -- One row per (source, check-run). Content hash enables real diff detection.
    -- "changed" is 0 on bootstrap (no previous snapshot to compare) or when hash matches.
    CREATE TABLE IF NOT EXISTS source_snapshots (
      id              TEXT PRIMARY KEY,
      check_run_id    TEXT NOT NULL REFERENCES watcher_check_log(id),
      source_id       TEXT NOT NULL,      -- matches an entry in sources.ts
      url             TEXT NOT NULL,
      content_hash    TEXT NOT NULL,      -- SHA-256 of stripped visible text
      content_excerpt TEXT NOT NULL,      -- first 4 KB of stripped text
      checked_at      TEXT NOT NULL,
      changed         INTEGER NOT NULL DEFAULT 0   -- 1 = hash differs from previous snapshot
    );

    -- Human-reviewable queue. Created only when a change is detected.
    -- The watcher NEVER modifies this table after creation — only humans do.
    CREATE TABLE IF NOT EXISTS rule_review_queue (
      id                TEXT PRIMARY KEY,
      source_id         TEXT NOT NULL,
      source_url        TEXT NOT NULL,
      diff_summary      TEXT NOT NULL,    -- Claude-generated plain-language summary
      affected_rule_ids TEXT NOT NULL,    -- JSON array of ComplianceRule IDs
      created_at        TEXT NOT NULL,
      status            TEXT NOT NULL DEFAULT 'pending',
        -- 'pending' | 'reviewed-no-change' | 'reviewed-rule-updated' | 'reviewed-false-positive'
      reviewed_at       TEXT,
      reviewer_note     TEXT              -- required when status = 'reviewed-rule-updated'
    );

    -- ── Observability metrics ─────────────────────────────────────────────────
    -- Append-only timing samples. One row per instrumented call.
    -- name: 'rule_eval' | 'ask_agent' | 'dso_email'
    CREATE TABLE IF NOT EXISTS metrics (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      value_ms    REAL NOT NULL,
      tags        TEXT NOT NULL DEFAULT '{}',   -- JSON metadata
      recorded_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics(name, recorded_at DESC);
  `);
}
