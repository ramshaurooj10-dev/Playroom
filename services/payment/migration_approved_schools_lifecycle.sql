-- ==============================================================================
-- MIGRATION: Approved Schools & License Lifecycle Support
-- File: src/services/payment/migration_approved_schools_lifecycle.sql
-- ==============================================================================

-- 1. Ensure columns allow NULL for PENDING/unactivated creation state
ALTER TABLE public.school_licenses 
ALTER COLUMN start_date DROP NOT NULL;

ALTER TABLE public.school_licenses 
ALTER COLUMN expiry_date DROP NOT NULL;

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'school_licenses' AND column_name = 'valid_from'
  ) THEN
    ALTER TABLE public.school_licenses ALTER COLUMN valid_from DROP NOT NULL;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'school_licenses' AND column_name = 'valid_until'
  ) THEN
    ALTER TABLE public.school_licenses ALTER COLUMN valid_until DROP NOT NULL;
  END IF;
END $$;

-- 2. Add country and school_admin_name columns to school_licenses if not present
ALTER TABLE public.school_licenses 
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Pakistan';

ALTER TABLE public.school_licenses 
ADD COLUMN IF NOT EXISTS school_admin_name TEXT;

-- 3. Update verify_school_license stored procedure to support unactivated PENDING licenses
CREATE OR REPLACE FUNCTION public.verify_school_license(
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
  v_new_expiry TIMESTAMPTZ;
  v_status TEXT;
BEGIN
  -- Search license by exact key (case-insensitive) or by ID
  SELECT * INTO v_lic
  FROM public.school_licenses
  WHERE UPPER(TRIM(license_key)) = UPPER(TRIM(p_license_key))
     OR UPPER(TRIM(id::TEXT)) = UPPER(TRIM(p_license_key))
  LIMIT 1;

  IF v_lic IS NULL THEN
    RETURN jsonb_build_object(
      'is_valid', false,
      'success', false,
      'error', 'Invalid license key. Please check your key and try again.'
    );
  END IF;

  v_status := UPPER(COALESCE(v_lic.status, 'PENDING'));

  -- Check if revoked
  IF v_status = 'REVOKED' THEN
    RETURN jsonb_build_object(
      'is_valid', false,
      'success', false,
      'status', 'REVOKED',
      'error', 'This license key has been revoked. Please contact administration.'
    );
  END IF;

  -- Lifecycle Transition: If PENDING or valid_from IS NULL -> Activate upon first key usage
  IF v_status = 'PENDING' OR v_lic.valid_from IS NULL OR v_lic.start_date IS NULL THEN
    v_new_expiry := v_now + INTERVAL '30 days';
    
    UPDATE public.school_licenses
    SET status = 'ACTIVE',
        valid_from = v_now,
        valid_until = v_new_expiry,
        start_date = v_now,
        expiry_date = v_new_expiry
    WHERE id = v_lic.id;

    -- Update license record in memory
    v_lic.status := 'ACTIVE';
    v_lic.valid_from := v_now;
    v_lic.valid_until := v_new_expiry;
    v_lic.start_date := v_now;
    v_lic.expiry_date := v_new_expiry;
  END IF;

  -- Check if expired
  IF v_lic.valid_until IS NOT NULL AND v_lic.valid_until < v_now THEN
    RETURN jsonb_build_object(
      'is_valid', false,
      'success', false,
      'status', 'EXPIRED',
      'error', 'This school license has expired. Please contact administration to renew your license.'
    );
  END IF;

  -- Get School metadata if available
  IF v_lic.school_id IS NOT NULL THEN
    SELECT * INTO v_school
    FROM public.schools
    WHERE id = v_lic.school_id
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'is_valid', true,
    'success', true,
    'license_id', v_lic.id,
    'school_id', v_lic.school_id,
    'school_name', COALESCE(v_lic.school_name, v_school.school_name, 'Partner Institution'),
    'school_admin_name', COALESCE(v_lic.school_admin_name, v_school.school_admin_name, 'School Administrator'),
    'contact_email', COALESCE(v_lic.contact_email, v_school.contact_email, ''),
    'license_key', v_lic.license_key,
    'status', 'ACTIVE',
    'valid_from', v_lic.valid_from,
    'valid_until', v_lic.valid_until,
    'days_remaining', GREATEST(0, EXTRACT(DAY FROM (v_lic.valid_until - v_now))::INTEGER),
    'allowed_devices', COALESCE(v_lic.allowed_devices, 999999),
    'page1_access', COALESCE(v_lic.page1_access, true),
    'page2_access', COALESCE(v_lic.page2_access, true)
  );
END;
$$;
