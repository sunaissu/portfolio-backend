-- Apply before deploying the session-aware backend. Existing sessions must sign in again.
-- Never store raw access or refresh tokens in this table.
CREATE TABLE IF NOT EXISTS portfolio_auth_session (
  id uuid PRIMARY KEY,
  user_id integer NOT NULL REFERENCES admin_user(id) ON DELETE CASCADE,
  refresh_digest varchar(64) NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS portfolio_auth_session_expiry ON portfolio_auth_session (expires_at);
CREATE INDEX IF NOT EXISTS portfolio_auth_session_user ON portfolio_auth_session (user_id);
REVOKE ALL ON portfolio_auth_session FROM PUBLIC;

-- Supabase can grant new public-schema tables to browser roles by default.
-- Sessions are server-only; no browser-facing RLS policies are created.
ALTER TABLE portfolio_auth_session ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON portfolio_auth_session FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON portfolio_auth_session FROM authenticated';
  END IF;
END;
$$;
