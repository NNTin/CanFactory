CREATE TABLE model_revisions (
  id text NOT NULL,
  version text NOT NULL,
  source_hash text NOT NULL,
  detail jsonb NOT NULL,
  reference_key text NOT NULL,
  reference_sha256 text NOT NULL,
  PRIMARY KEY (id, source_hash)
);
CREATE TABLE catalogue (
  id text PRIMARY KEY,
  source_hash text NOT NULL,
  FOREIGN KEY (id, source_hash) REFERENCES model_revisions(id, source_hash)
);
CREATE TABLE render_jobs (
  id uuid PRIMARY KEY,
  cache_key text UNIQUE NOT NULL,
  model_id text NOT NULL,
  model_version text NOT NULL,
  source_hash text NOT NULL,
  renderer_fingerprint text NOT NULL,
  parameters jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  created_at bigint NOT NULL,
  expires_at bigint NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  lease_token uuid,
  lease_until bigint,
  slot_count integer,
  artifact jsonb,
  object_key text,
  error jsonb,
  FOREIGN KEY (model_id, source_hash) REFERENCES model_revisions(id, source_hash)
);
CREATE INDEX render_jobs_queue ON render_jobs(created_at) WHERE status = 'queued';
CREATE INDEX render_jobs_expiry ON render_jobs(expires_at);
CREATE INDEX render_jobs_leases ON render_jobs(lease_until) WHERE status = 'running';
CREATE INDEX render_jobs_object ON render_jobs(object_key) WHERE object_key IS NOT NULL;
CREATE TABLE workers (id uuid PRIMARY KEY, heartbeat_at bigint NOT NULL);
CREATE TABLE object_deletions (
  object_key text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 0,
  retry_after bigint NOT NULL DEFAULT 0
);
