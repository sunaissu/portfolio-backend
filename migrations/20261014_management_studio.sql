-- Authenticated management only. No browser database policies.
CREATE TABLE IF NOT EXISTS portfolio_studio (
 id integer PRIMARY KEY CHECK(id=1), version integer NOT NULL DEFAULT 0,
 draft jsonb NOT NULL, published jsonb, published_at timestamptz,
 history jsonb NOT NULL DEFAULT '[]', trash jsonb NOT NULL DEFAULT '[]',
 comments jsonb NOT NULL DEFAULT '[]', settings jsonb NOT NULL DEFAULT '{}',
 review_version integer, reviewed_by integer, snapshot jsonb,
 updated_at timestamptz NOT NULL DEFAULT NOW(), updated_by integer NOT NULL
);
CREATE TABLE IF NOT EXISTS portfolio_studio_recovery (
 actor_id integer PRIMARY KEY REFERENCES admin_user(id) ON DELETE CASCADE,
 version integer NOT NULL DEFAULT 1, base_version integer NOT NULL,
 draft jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT NOW()
);
ALTER TABLE portfolio_auth_session ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW();
ALTER TABLE portfolio_auth_session ADD COLUMN IF NOT EXISTS label varchar(80) NOT NULL DEFAULT 'Browser session';
ALTER TABLE portfolio_studio ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_studio_recovery ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON portfolio_studio, portfolio_studio_recovery FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE 'REVOKE ALL ON portfolio_studio, portfolio_studio_recovery FROM anon'; END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE 'REVOKE ALL ON portfolio_studio, portfolio_studio_recovery FROM authenticated'; END IF;
END $$;
ALTER TABLE portfolio_inquiry ADD COLUMN IF NOT EXISTS "internalNotes" text NOT NULL DEFAULT '';
ALTER TABLE portfolio_inquiry ADD COLUMN IF NOT EXISTS "repliedAt" timestamptz;
