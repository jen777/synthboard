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
  -- Membership tier (1–4). New accounts start at Level 1; the per-level
  -- visualization quota lives in app_settings (level_N_limit).
  level       SMALLINT NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Backfill for databases created before is_admin existed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
-- Backfill for databases created before account levels existed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS level SMALLINT NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS visualizations (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  preset      TEXT NOT NULL,
  source_text TEXT NOT NULL,
  -- Null until generation finishes. Generation runs in the background so the
  -- HTTP request can return immediately (avoids the proxy/Cloudflare 524).
  drawio_xml  TEXT,
  -- Lifecycle: 'pending' → 'processing' → 'completed' | 'failed'.
  status      TEXT NOT NULL DEFAULT 'completed',
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Backfill for databases created before async generation existed. Existing
-- rows already hold finished XML, so they default to 'completed'.
ALTER TABLE visualizations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE visualizations ADD COLUMN IF NOT EXISTS error TEXT;
ALTER TABLE visualizations ALTER COLUMN drawio_xml DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_visualizations_user
  ON visualizations(user_id, created_at DESC);

-- Runtime-editable application settings (key/value), managed via the admin panel.
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-generation telemetry for diagrams produced by the LLM. One row is written
-- each time generation finishes (success or failure). Kept in its own table so
-- the visualizations table stays lean and the admin report can aggregate freely.
CREATE TABLE IF NOT EXISTS diagram_generations (
  id                BIGSERIAL PRIMARY KEY,
  visualization_id  BIGINT REFERENCES visualizations(id) ON DELETE CASCADE,
  user_id           BIGINT REFERENCES users(id) ON DELETE CASCADE,
  preset            TEXT,
  model             TEXT,
  -- 'completed' | 'failed' — mirrors the visualization outcome.
  status            TEXT NOT NULL DEFAULT 'completed',
  -- Wall-clock time of the LLM call, and time to first streamed token.
  generation_ms     INTEGER,
  first_token_ms    INTEGER,
  -- Size of the generated draw.io XML, in UTF-8 bytes.
  diagram_bytes     INTEGER,
  -- Token accounting reported by the model.
  prompt_tokens     INTEGER,
  completion_tokens INTEGER,
  total_tokens      INTEGER,
  -- Sampling parameters and stop reason used for the call.
  temperature       REAL,
  top_p             REAL,
  finish_reason     TEXT,
  -- Any extra provider metadata we want to keep without a column each.
  meta              JSONB,
  error             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diagram_generations_created
  ON diagram_generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diagram_generations_user
  ON diagram_generations(user_id);

-- Draw.io custom library catalog. Libraries are ingested from public or local
-- <mxlibrary> XML files, indexed by compact metadata, and referenced during LLM
-- generation without putting the full icon payloads into the prompt.
CREATE TABLE IF NOT EXISTS drawio_icon_libraries (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  provider      TEXT,
  style_family  TEXT,
  source_url    TEXT,
  source_type   TEXT,
  version       TEXT,
  object_count  INTEGER NOT NULL DEFAULT 0,
  metadata      JSONB,
  ingested_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drawio_icon_objects (
  id             TEXT PRIMARY KEY,
  library_id     TEXT NOT NULL REFERENCES drawio_icon_libraries(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  search_text    TEXT NOT NULL,
  aliases        TEXT[] NOT NULL DEFAULT '{}',
  width          REAL,
  height         REAL,
  aspect         TEXT,
  style          TEXT,
  cell_xml       TEXT,
  xml_compressed TEXT NOT NULL,
  metadata       JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drawio_icon_objects_library
  ON drawio_icon_objects(library_id);
CREATE INDEX IF NOT EXISTS idx_drawio_icon_objects_search_text
  ON drawio_icon_objects USING gin (to_tsvector('simple', search_text));
`;

export async function initSchema() {
  await pool.query(SCHEMA);
}
