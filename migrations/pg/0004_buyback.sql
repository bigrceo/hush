CREATE TABLE IF NOT EXISTS buybacks (
  id SERIAL PRIMARY KEY,
  at BIGINT NOT NULL,
  status TEXT NOT NULL,          -- done | skipped | dry-run | failed
  sol_in BIGINT NOT NULL DEFAULT 0,      -- lamports swapped
  tokens_burned TEXT,                    -- raw token units burned
  decimals INTEGER,
  swap_sig TEXT,
  burn_sig TEXT,
  note TEXT
);
CREATE INDEX IF NOT EXISTS buybacks_at ON buybacks(at DESC);
