// Tables are created automatically the first time the app touches an empty database
// (see query() in db.ts). Every statement is idempotent. Timestamps are unix seconds (UTC).
export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS galleries (
  id               TEXT PRIMARY KEY,
  slug             TEXT NOT NULL UNIQUE,
  title            TEXT NOT NULL,
  client_name      TEXT NOT NULL,
  password_hash    TEXT,
  created_at       BIGINT NOT NULL,
  expires_at       BIGINT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired')),
  zip_key          TEXT,
  zip_bytes        BIGINT NOT NULL DEFAULT 0,
  total_bytes      BIGINT NOT NULL DEFAULT 0,
  expiry_warned_at BIGINT,
  purged_at        BIGINT
)`,
  `CREATE INDEX IF NOT EXISTS idx_galleries_status_expires ON galleries (status, expires_at)`,
  `CREATE TABLE IF NOT EXISTS photos (
  id           TEXT PRIMARY KEY,
  gallery_id   TEXT NOT NULL REFERENCES galleries (id) ON DELETE CASCADE,
  filename     TEXT NOT NULL,
  original_key TEXT NOT NULL,
  preview_key  TEXT NOT NULL,
  thumb_key    TEXT NOT NULL,
  size_bytes   BIGINT NOT NULL,   
  width        INTEGER NOT NULL,
  height       INTEGER NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready')),
  created_at   BIGINT NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS idx_photos_gallery ON photos (gallery_id, sort_order)`,
  `CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT PRIMARY KEY,
  count        INTEGER NOT NULL,
  window_start BIGINT NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS usage (
  month TEXT NOT NULL,
  kind  TEXT NOT NULL,
  count BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (month, kind)
)`,
];
