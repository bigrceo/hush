CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner TEXT NOT NULL,
  pubkey TEXT NOT NULL,
  secret_enc TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  daily_budget DOUBLE PRECISION NOT NULL,
  per_call_cap DOUBLE PRECISION NOT NULL,
  allowlist TEXT NOT NULL,
  frozen INTEGER NOT NULL DEFAULT 0,
  spent_day TEXT NOT NULL,
  spent_sol DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS agents_owner ON agents(owner);
CREATE TABLE IF NOT EXISTS owners (owner TEXT PRIMARY KEY, frozen_all INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS receipts (
  nonce TEXT PRIMARY KEY,
  signature TEXT NOT NULL,
  listing TEXT NOT NULL,
  resource TEXT NOT NULL,
  currency TEXT NOT NULL,
  total TEXT NOT NULL,
  legs TEXT NOT NULL,
  payer TEXT NOT NULL,
  ok INTEGER NOT NULL,
  refund_signature TEXT,
  latency_ms INTEGER NOT NULL,
  at BIGINT NOT NULL,
  commitment TEXT NOT NULL,
  agent_id TEXT
);
CREATE INDEX IF NOT EXISTS receipts_at ON receipts(at DESC);
CREATE INDEX IF NOT EXISTS receipts_agent ON receipts(agent_id);
CREATE INDEX IF NOT EXISTS receipts_sig ON receipts(signature);
CREATE TABLE IF NOT EXISTS used_signatures (signature TEXT PRIMARY KEY, at BIGINT NOT NULL);
