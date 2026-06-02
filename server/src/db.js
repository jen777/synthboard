import pg from "pg";
import { config } from "./config.js";

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  // Managed Postgres typically terminates TLS with a cert chain Node won't
  // verify out of the box; rejectUnauthorized:false keeps the connection
  // encrypted without requiring the CA bundle.
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
});

export function query(text, params) {
  return pool.query(text, params);
}

// Idempotent schema setup. Runs on boot; safe to re-run.
// The `session` table used by connect-pg-simple is created separately
// (createTableIfMissing: true) in index.js.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id          BIGSERIAL PRIMARY KEY,
  google_id   TEXT UNIQUE NOT NULL,
  email       TEXT NOT NULL,
  name        TEXT,
  avatar_url  TEXT,
  is_admin    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Backfill for databases created before is_admin existed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS visualizations (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  preset      TEXT NOT NULL,
  source_text TEXT NOT NULL,
  drawio_xml  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visualizations_user
  ON visualizations(user_id, created_at DESC);

-- Runtime-editable application settings (key/value), managed via the admin panel.
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

export async function initSchema() {
  await pool.query(SCHEMA);
}
