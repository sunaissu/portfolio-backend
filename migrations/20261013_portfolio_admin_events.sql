BEGIN;
CREATE TABLE IF NOT EXISTS portfolio_admin_event (
  id uuid PRIMARY KEY,
  actor_id integer NOT NULL,
  action varchar(80) NOT NULL,
  entity_id varchar(100) NOT NULL,
  version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS portfolio_admin_event_created ON portfolio_admin_event (created_at DESC);
ALTER TABLE portfolio_admin_event ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE portfolio_admin_event FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE 'REVOKE ALL ON TABLE portfolio_admin_event FROM anon'; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE 'REVOKE ALL ON TABLE portfolio_admin_event FROM authenticated'; END IF;
END $$;
COMMIT;
