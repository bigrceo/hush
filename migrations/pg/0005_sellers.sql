CREATE TABLE IF NOT EXISTS sellers (
  id TEXT PRIMARY KEY,           -- listing id is "s-" || id
  owner TEXT NOT NULL,           -- seller wallet (Solana pubkey), receives sweeps
  name TEXT NOT NULL,
  url TEXT NOT NULL,             -- upstream https endpoint HUSH calls after payment
  price_lamports BIGINT NOT NULL,
  description TEXT NOT NULL,
  input TEXT,                    -- optional query param name forwarded from the buyer
  active INTEGER NOT NULL DEFAULT 1,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS sellers_owner ON sellers(owner);
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS swept_sig TEXT;
