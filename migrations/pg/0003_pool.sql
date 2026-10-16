ALTER TABLE agents ADD COLUMN IF NOT EXISTS balance_lamports BIGINT NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS ledger (
  id SERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL,
  kind TEXT NOT NULL,            -- deposit | buy | refund | withdraw | release
  lamports BIGINT NOT NULL,      -- signed: credit > 0, debit < 0
  ref TEXT,                      -- on-chain signature or receipt nonce (private, never exposed)
  at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS ledger_agent ON ledger(agent_id, at DESC);
