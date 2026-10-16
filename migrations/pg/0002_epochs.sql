CREATE TABLE IF NOT EXISTS epochs (
  id SERIAL PRIMARY KEY,
  root TEXT NOT NULL,
  leaf_count INTEGER NOT NULL,
  first_at BIGINT NOT NULL,
  last_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL,
  anchor_status TEXT NOT NULL DEFAULT 'pending',
  anchor_sig TEXT,
  anchor_error TEXT,
  anchored_at BIGINT
);
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS epoch_id INTEGER;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS leaf_index INTEGER;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS leaf TEXT;
CREATE INDEX IF NOT EXISTS receipts_epoch ON receipts(epoch_id, leaf_index);
CREATE INDEX IF NOT EXISTS receipts_unsealed ON receipts(at) WHERE epoch_id IS NULL;
