CREATE TABLE models (
  id TEXT PRIMARY KEY NOT NULL, version TEXT NOT NULL, detail TEXT NOT NULL,
  source_hash TEXT NOT NULL, reference_name TEXT NOT NULL
);
CREATE TABLE render_jobs (
  id TEXT PRIMARY KEY NOT NULL, cache_key TEXT NOT NULL UNIQUE,
  model_id TEXT NOT NULL, model_version TEXT NOT NULL,
  source_hash TEXT NOT NULL, renderer_fingerprint TEXT NOT NULL,
  parameters TEXT NOT NULL, status TEXT NOT NULL,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0, lease_token TEXT, lease_until INTEGER,
  slot_count INTEGER, artifact TEXT, error TEXT
);
CREATE INDEX render_jobs_queue ON render_jobs(status, created_at);
CREATE INDEX render_jobs_expiry ON render_jobs(expires_at);
CREATE TABLE workers (id TEXT PRIMARY KEY NOT NULL, heartbeat_at INTEGER NOT NULL);
