BEGIN;
CREATE TABLE IF NOT EXISTS portfolio_publication (
  id integer PRIMARY KEY CHECK (id = 1),
  version integer NOT NULL DEFAULT 1,
  draft jsonb NOT NULL,
  published jsonb,
  "publishedAt" timestamptz,
  history jsonb NOT NULL DEFAULT '[]'::jsonb
);
ALTER TABLE portfolio_publication ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE portfolio_publication FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE 'REVOKE ALL ON TABLE portfolio_publication FROM anon'; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE 'REVOKE ALL ON TABLE portfolio_publication FROM authenticated'; END IF;
END $$;
COMMIT;
