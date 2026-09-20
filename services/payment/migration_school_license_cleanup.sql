-- ==============================================================================
-- MIGRATION: School License System Final Cleanup (30-Day Term, Unlimited Devices, License Key Flow)
-- File: src/services/payment/migration_school_license_cleanup.sql
-- ==============================================================================

-- 1. Ensure license_key column exists in school_licenses with unique index
ALTER TABLE public.school_licenses 
ADD COLUMN IF NOT EXISTS license_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_school_licenses_key 
ON public.school_licenses(license_key);

-- Populate existing rows where license_key is null with their ID
UPDATE public.school_licenses 
SET license_key = id 
WHERE license_key IS NULL;

-- 2. Update default device limits to unlimited (999999) across tables
ALTER TABLE public.schools 
ALTER COLUMN device_limit SET DEFAULT 999999;

ALTER TABLE public.school_licenses 
ALTER COLUMN allowed_devices SET DEFAULT 999999;

UPDATE public.schools 
SET device_limit = 999999 
WHERE device_limit < 999999;

UPDATE public.school_licenses 
SET allowed_devices = 999999 
WHERE allowed_devices < 999999;

-- 3. Deactivate legacy multi-month school plans and ensure 30-day standard plan
UPDATE public.plans 
SET is_active = false 
WHERE id IN ('school_3months', 'school_6months', 'school_12months');

INSERT INTO public.plans (id, name, description, type, price_pkr, price_usd, duration_months, duration_days, device_limit, level_number, is_active)
VALUES (
  'school_license_30d',
  'School License (30 Days)',
  'Preschool institution license for unlimited classroom devices with full Playroom and Education Hub access for 30 days.',
  'school',
  25000,
  100,
  1,
  30,
  999999,
  NULL,
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_pkr = EXCLUDED.price_pkr,
  price_usd = EXCLUDED.price_usd,
  duration_months = 1,
  duration_days = 30,
  device_limit = 999999,
  is_active = true;

-- 4. Stored Procedure for verifying school license keys
CREATE OR REPLACE FUNCTION public.verify_school_license_key(
  p_license_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lic RECORD;
  v_school RECORD;
  v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
  -- Search by license_key or fallback by id
  SELECT * INTO v_lic
  FROM public.school_licenses
  WHERE UPPER(license_key) = UPPER(TRIM(p_license_key))
     OR UPPER(id) = UPPER(TRIM(p_license_key))
  LIMIT 1;

  IF v_lic IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'License key not found. Please check your key or contact the administrator.'
    );
  END IF;

  IF v_lic.status != 'ACTIVE' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This school license has been revoked or deactivated. Please contact support.'
    );
  END IF;

  IF v_lic.expiry_date < v_now THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This school license has expired. Please contact the administrator for a manual renewal.'
    );
  END IF;

  -- Retrieve school details
  SELECT * INTO v_school
  FROM public.schools
  WHERE id = v_lic.school_id
  LIMIT 1;

  RETURN jsonb_build_object(
    'success', true,
    'school_id', v_lic.school_id,
    'school_name', COALESCE(v_school.school_name, 'Partner Institution'),
    'contact_email', COALESCE(v_school.contact_email, ''),
    'license_key', v_lic.license_key,
    'start_date', v_lic.start_date,
    'expiry_date', v_lic.expiry_date,
    'days_remaining', GREATEST(0, EXTRACT(DAY FROM (v_lic.expiry_date - v_now))::INTEGER),
    'unlimited_devices', true,
    'page1_access', v_lic.page1_access,
    'page2_access', v_lic.page2_access
  );
END;
$$;
