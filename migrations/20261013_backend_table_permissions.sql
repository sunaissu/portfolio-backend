-- The public portfolio is served by the backend projection, never direct table reads.
-- The backend connection must use the table owner or a dedicated BYPASSRLS role.
BEGIN;
DO $$
DECLARE table_name text;
        browser_role text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'admin_user', 'admin_user_provider', 'ai_config', 'personal_info', 'project',
    'project_link', 'technology', 'project_technologies_technology', 'skill',
    'skill_item', 'experience', 'experience_role', 'experience_responsibility',
    'resume', 'portfolio_education', 'portfolio_auth_session',
    'portfolio_publication', 'portfolio_inquiry', 'portfolio_admin_event'
  ] LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', table_name);
      FOREACH browser_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = browser_role) THEN
          EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', table_name, browser_role);
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END $$;
COMMIT;
