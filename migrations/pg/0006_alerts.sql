ALTER TABLE owners ADD COLUMN IF NOT EXISTS alert_webhook TEXT;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS alert_pct INTEGER NOT NULL DEFAULT 80;
CREATE TABLE IF NOT EXISTS alerts (
  id BIGSERIAL PRIMARY KEY,
  owner TEXT NOT NULL,
  agent_id TEXT,
  kind TEXT NOT NULL,            -- budget | blocked | frozen | unfrozen | test
  message TEXT NOT NULL,
  delivered INTEGER NOT NULL DEFAULT 0,
  at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS alerts_owner_at ON alerts(owner, at DESC);
