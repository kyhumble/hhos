-- Phase 8: Row Level Security for multi-tenant isolation.
-- Access when app.rls_bypass = 'on' OR org_id matches app.current_org_id.
-- API sets these via transaction-local set_config when FEATURE_RLS=true.
--
-- IMPORTANT: Superusers / BYPASSRLS roles ignore RLS. Production and
-- FEATURE_RLS testing must use a non-superuser role (hhos_app below).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hhos_app') THEN
    CREATE ROLE hhos_app LOGIN PASSWORD 'hhos_app_dev' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO hhos_app', current_database());
END $$;
GRANT USAGE ON SCHEMA public TO hhos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hhos_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hhos_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hhos_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO hhos_app;

CREATE OR REPLACE FUNCTION hhos_rls_org_ok(row_org uuid) RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    -- When app.rls_enforced is not 'on' (default), allow all rows (local dogfood).
    COALESCE(current_setting('app.rls_enforced', true), '') IS DISTINCT FROM 'on'
    OR COALESCE(current_setting('app.rls_bypass', true), '') = 'on'
    OR (
      NULLIF(current_setting('app.current_org_id', true), '') IS NOT NULL
      AND row_org = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    );
$$;

-- Helper: apply RLS + FORCE + policy for a single org_id table
-- (expanded per table below for clarity / greppability)

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'patients',
    'patient_addresses',
    'patient_contacts',
    'coverages',
    'clinical_history_items',
    'patient_flags',
    'referrals',
    'episodes',
    'care_team_members',
    'intake_checklist_items',
    'orders_tracking',
    'clinical_documents_meta',
    'episode_timeline_events',
    'users',
    'roles',
    'consent_templates',
    'consent_records',
    'audit_events',
    'devices',
    'wounds',
    'visits',
    'wound_photos',
    'photo_annotations',
    'clinical_tasks',
    'oasis_assessments',
    'oasis_item_responses',
    'clinician_profiles',
    'route_suggestions',
    'visit_tasks',
    'hospitalization_alerts',
    'org_invites',
    'order_packages',
    'signature_requests',
    'hospice_elections',
    'hospice_benefit_periods',
    'hospice_loc_stays',
    'billing_claim_packages'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS hhos_org_isolation ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY hhos_org_isolation ON public.%I FOR ALL USING (hhos_rls_org_ok(org_id)) WITH CHECK (hhos_rls_org_ok(org_id))',
        t
      );
    END IF;
  END LOOP;
END $$;

-- organizations: match on id, not org_id
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hhos_org_isolation ON public.organizations;
CREATE POLICY hhos_org_isolation ON public.organizations
  FOR ALL
  USING (hhos_rls_org_ok(id))
  WITH CHECK (hhos_rls_org_ok(id));

-- Global catalog tables: readable when bypass or any authenticated org session
-- (permission codes are not tenant-specific)
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hhos_permissions_read ON public.permissions;
CREATE POLICY hhos_permissions_read ON public.permissions
  FOR SELECT
  USING (
    COALESCE(current_setting('app.rls_enforced', true), '') IS DISTINCT FROM 'on'
    OR COALESCE(current_setting('app.rls_bypass', true), '') = 'on'
    OR NULLIF(current_setting('app.current_org_id', true), '') IS NOT NULL
  );
DROP POLICY IF EXISTS hhos_permissions_write ON public.permissions;
CREATE POLICY hhos_permissions_write ON public.permissions
  FOR ALL
  USING (
    COALESCE(current_setting('app.rls_enforced', true), '') IS DISTINCT FROM 'on'
    OR COALESCE(current_setting('app.rls_bypass', true), '') = 'on'
  )
  WITH CHECK (
    COALESCE(current_setting('app.rls_enforced', true), '') IS DISTINCT FROM 'on'
    OR COALESCE(current_setting('app.rls_bypass', true), '') = 'on'
  );

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hhos_role_permissions_all ON public.role_permissions;
CREATE POLICY hhos_role_permissions_all ON public.role_permissions
  FOR ALL
  USING (
    COALESCE(current_setting('app.rls_bypass', true), '') = 'on'
    OR EXISTS (
      SELECT 1 FROM public.roles r
      WHERE r.id = role_permissions.role_id
        AND hhos_rls_org_ok(r.org_id)
    )
  )
  WITH CHECK (
    COALESCE(current_setting('app.rls_bypass', true), '') = 'on'
    OR EXISTS (
      SELECT 1 FROM public.roles r
      WHERE r.id = role_permissions.role_id
        AND hhos_rls_org_ok(r.org_id)
    )
  );

-- consent_template_purposes: no org_id — via template
ALTER TABLE public.consent_template_purposes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_template_purposes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hhos_ctp_all ON public.consent_template_purposes;
CREATE POLICY hhos_ctp_all ON public.consent_template_purposes
  FOR ALL
  USING (
    COALESCE(current_setting('app.rls_bypass', true), '') = 'on'
    OR EXISTS (
      SELECT 1 FROM public.consent_templates ct
      WHERE ct.id = consent_template_purposes.template_id
        AND hhos_rls_org_ok(ct.org_id)
    )
  )
  WITH CHECK (
    COALESCE(current_setting('app.rls_bypass', true), '') = 'on'
    OR EXISTS (
      SELECT 1 FROM public.consent_templates ct
      WHERE ct.id = consent_template_purposes.template_id
        AND hhos_rls_org_ok(ct.org_id)
    )
  );

-- user_roles: via users.org_id
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hhos_user_roles_all ON public.user_roles;
CREATE POLICY hhos_user_roles_all ON public.user_roles
  FOR ALL
  USING (
    COALESCE(current_setting('app.rls_bypass', true), '') = 'on'
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = user_roles.user_id AND hhos_rls_org_ok(u.org_id)
    )
  )
  WITH CHECK (
    COALESCE(current_setting('app.rls_bypass', true), '') = 'on'
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = user_roles.user_id AND hhos_rls_org_ok(u.org_id)
    )
  );

-- consent_signatures / revocations: via consent_records
ALTER TABLE public.consent_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_signatures FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hhos_consent_sig_all ON public.consent_signatures;
CREATE POLICY hhos_consent_sig_all ON public.consent_signatures
  FOR ALL
  USING (
    COALESCE(current_setting('app.rls_bypass', true), '') = 'on'
    OR EXISTS (
      SELECT 1 FROM public.consent_records cr
      WHERE cr.id = consent_signatures.consent_record_id AND hhos_rls_org_ok(cr.org_id)
    )
  )
  WITH CHECK (
    COALESCE(current_setting('app.rls_bypass', true), '') = 'on'
    OR EXISTS (
      SELECT 1 FROM public.consent_records cr
      WHERE cr.id = consent_signatures.consent_record_id AND hhos_rls_org_ok(cr.org_id)
    )
  );

ALTER TABLE public.consent_revocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_revocations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hhos_consent_rev_all ON public.consent_revocations;
CREATE POLICY hhos_consent_rev_all ON public.consent_revocations
  FOR ALL
  USING (
    COALESCE(current_setting('app.rls_bypass', true), '') = 'on'
    OR EXISTS (
      SELECT 1 FROM public.consent_records cr
      WHERE cr.id = consent_revocations.consent_record_id AND hhos_rls_org_ok(cr.org_id)
    )
  )
  WITH CHECK (
    COALESCE(current_setting('app.rls_bypass', true), '') = 'on'
    OR EXISTS (
      SELECT 1 FROM public.consent_records cr
      WHERE cr.id = consent_revocations.consent_record_id AND hhos_rls_org_ok(cr.org_id)
    )
  );

-- device_revocations: via devices
ALTER TABLE public.device_revocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_revocations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hhos_device_rev_all ON public.device_revocations;
CREATE POLICY hhos_device_rev_all ON public.device_revocations
  FOR ALL
  USING (
    COALESCE(current_setting('app.rls_bypass', true), '') = 'on'
    OR EXISTS (
      SELECT 1 FROM public.devices d
      WHERE d.id = device_revocations.device_row_id AND hhos_rls_org_ok(d.org_id)
    )
  )
  WITH CHECK (
    COALESCE(current_setting('app.rls_bypass', true), '') = 'on'
    OR EXISTS (
      SELECT 1 FROM public.devices d
      WHERE d.id = device_revocations.device_row_id AND hhos_rls_org_ok(d.org_id)
    )
  );
