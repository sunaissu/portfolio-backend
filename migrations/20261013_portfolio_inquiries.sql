BEGIN;
CREATE TABLE IF NOT EXISTS portfolio_inquiry (
  id uuid PRIMARY KEY,
  "receiptHash" varchar(64) NOT NULL,
  "requestHash" varchar(64) NOT NULL,
  name varchar(100) NOT NULL,
  email varchar(254) NOT NULL,
  topic varchar(100) NOT NULL,
  message text NOT NULL,
  slot jsonb,
  status varchar(20) NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'reviewed', 'confirmed', 'declined', 'closed')),
  version integer NOT NULL DEFAULT 1,
  "createdAt" timestamptz NOT NULL,
  "expiresAt" timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS portfolio_inquiry_expiry ON portfolio_inquiry ("expiresAt");
ALTER TABLE portfolio_inquiry ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE portfolio_inquiry FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE 'REVOKE ALL ON TABLE portfolio_inquiry FROM anon'; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE 'REVOKE ALL ON TABLE portfolio_inquiry FROM authenticated'; END IF;
END $$;
COMMIT;
