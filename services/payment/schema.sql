-- ==============================================================================
-- PLAYROOM PRODUCTION SUPABASE DATABASE SCHEMA
-- File: src/services/payment/schema.sql
-- ==============================================================================

-- Enable UUID & crypto extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. PROFILES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  full_name TEXT,
  role TEXT DEFAULT 'parent' CHECK (role IN ('parent', 'educator', 'school_admin', 'admin')),
  school_id TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_school_id ON public.profiles(school_id);

-- ==============================================================================
-- 2. SCHOOLS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.schools (
  id TEXT PRIMARY KEY,
  school_name TEXT NOT NULL,
  school_admin_name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT UNIQUE NOT NULL,
  phone TEXT,
  address TEXT,
  country TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'PENDING')),
  account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'pending', 'inactive')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'pending', 'unpaid')),
  plan_id TEXT,
  device_limit INTEGER NOT NULL DEFAULT 15,
  custom_price NUMERIC(10,2),
  custom_device_limit INTEGER,
  custom_deal_note TEXT,
  currency TEXT NOT NULL DEFAULT 'PKR' CHECK (currency IN ('PKR', 'USD')),
  subscription_start TIMESTAMPTZ,
  subscription_expiry TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- Migration helper for existing databases:
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS country TEXT;
CREATE INDEX IF NOT EXISTS idx_schools_contact_email ON public.schools(contact_email);
CREATE INDEX IF NOT EXISTS idx_schools_status ON public.schools(status);
CREATE INDEX IF NOT EXISTS idx_schools_country ON public.schools(country);

-- ==============================================================================
-- 3. PLANS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('individual', 'school')),
  price_pkr NUMERIC(10,2) NOT NULL,
  price_usd NUMERIC(10,2) NOT NULL,
  duration_months INTEGER DEFAULT 1 NOT NULL,
  duration_days INTEGER DEFAULT 30 NOT NULL,
  device_limit INTEGER DEFAULT 1 NOT NULL,
  level_number INTEGER,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed Default Plans (Individual & School)
INSERT INTO public.plans (id, name, description, type, price_pkr, price_usd, duration_months, duration_days, device_limit, level_number, is_active)
VALUES
  ('indiv_level_1', 'Level 1: Nursery Explorers (Free Starter)', 'Playful foundation with letter shapes, first sounds, and colors.', 'individual', 0, 0, 1, 30, 1, 1, true),
  ('indiv_level_2', 'Level 2: Phonics & Math Beginners', 'Beginning letter sounds, counting up to 10, pattern recognition.', 'individual', 800, 5, 1, 30, 1, 2, true),
  ('indiv_level_3', 'Level 3: Early Word Builders & Addition', 'Word blends, simple addition, rhyming words, and classification.', 'individual', 800, 5, 1, 30, 1, 3, true),
  ('indiv_level_4', 'Level 4: Reading Sentences & Math Explorer', 'Sentence construction, subtraction, 2D/3D shapes, and logic.', 'individual', 800, 5, 1, 30, 1, 4, true),
  ('indiv_level_5', 'Level 5: Advanced Kindergarten Phonics & Logic', 'Complex phonics, reading comprehension, skip counting, time & money.', 'individual', 800, 5, 1, 30, 1, 5, true),
  ('indiv_level_6', 'Level 6: Grade 1 Readiness & Mastery', 'Fluent reading, critical thinking puzzles, multi-step math challenges.', 'individual', 800, 5, 1, 30, 1, 6, true),
  ('indiv_all_activities', 'All Activities (Full Access)', 'Unlock 100% full access to all preschool learning activities, phonics, math, and games for 1 month.', 'individual', 5000, 20, 1, 30, 1, NULL, true),
  ('school_monthly', 'School Monthly License', 'Preschool classroom license for standard 15 devices with full Page 1 Playroom and Page 2 Educator Hub access for 1 month.', 'school', 25000, 100, 1, 30, 15, NULL, true),
  ('school_3months', 'School 3 Months License', 'Preschool classroom license for standard 15 devices with full Page 1 Playroom and Page 2 Educator Hub access for 3 months.', 'school', 70000, 280, 3, 90, 15, NULL, true),
  ('school_6months', 'School 6 Months License', 'Preschool classroom license for standard 15 devices with full Page 1 Playroom and Page 2 Educator Hub access for 6 months.', 'school', 120000, 480, 6, 180, 15, NULL, true),
  ('school_12months', 'School 12 Months License', 'Comprehensive preschool annual license for standard 15 devices with full Page 1 Playroom and Page 2 Educator Hub access for 1 full year.', 'school', 220000, 880, 12, 365, 15, NULL, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_pkr = EXCLUDED.price_pkr,
  price_usd = EXCLUDED.price_usd,
  duration_months = EXCLUDED.duration_months,
  duration_days = EXCLUDED.duration_days,
  device_limit = EXCLUDED.device_limit,
  is_active = EXCLUDED.is_active;

-- ==============================================================================
-- 4. PURCHASES (User & School Subscriptions / Access Rights)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.purchases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  product_id TEXT NOT NULL,
  plan_id TEXT,
  access_status TEXT NOT NULL DEFAULT 'active' CHECK (access_status IN ('active', 'expired', 'revoked')),
  access_level TEXT NOT NULL DEFAULT 'full',
  start_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  expiry_date TIMESTAMPTZ NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'pending', 'failed')),
  payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_purchases_user_email ON public.purchases(user_email);
CREATE INDEX IF NOT EXISTS idx_purchases_access_status ON public.purchases(access_status);

-- ==============================================================================
-- 5. SCHOOL DEVICES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.school_devices (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_name TEXT,
  registered_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  last_login TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_school_device_reg UNIQUE (school_id, device_id)
);
CREATE INDEX IF NOT EXISTS idx_school_devices_school_id ON public.school_devices(school_id);
CREATE INDEX IF NOT EXISTS idx_school_devices_active ON public.school_devices(is_active);

-- ==============================================================================
-- 6. SCHOOL REQUESTS (Inquiries / Deal Requests / Support)
-- ==============================================================================
-- Primary schema table: public.school_request (singular)
CREATE TABLE IF NOT EXISTS public.school_request (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_school_request_school_id ON public.school_request(school_id);

-- Plural schema table: public.school_requests (with workflow statuses)
CREATE TABLE IF NOT EXISTS public.school_requests (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  requested_by TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'replied', 'approved', 'rejected')),
  admin_reply TEXT,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_school_requests_school_id ON public.school_requests(school_id);
CREATE INDEX IF NOT EXISTS idx_school_requests_status ON public.school_requests(status);

-- ==============================================================================
-- 7. SCHOOL MESSAGES (Live 2-Way School Administrator Chat)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.school_messages (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('school', 'admin')),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_school_messages_school_id ON public.school_messages(school_id);
CREATE INDEX IF NOT EXISTS idx_school_messages_unread ON public.school_messages(school_id, is_read);

-- ==============================================================================
-- 8. SCHOOL PAYMENTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.school_payments (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  school_name TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  standard_price NUMERIC(10,2) NOT NULL,
  custom_price NUMERIC(10,2),
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('PKR', 'USD')),
  device_limit INTEGER NOT NULL DEFAULT 15,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('sadapay', 'jazzcash', 'bank_transfer')),
  transaction_reference TEXT NOT NULL,
  payment_proof_name TEXT,
  payment_proof_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_school_payments_school_id ON public.school_payments(school_id);
CREATE INDEX IF NOT EXISTS idx_school_payments_status ON public.school_payments(status);

-- ==============================================================================
-- 9. INDIVIDUAL PAYMENTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.individual_payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  selected_level INTEGER,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('PKR', 'USD')),
  payment_method TEXT NOT NULL,
  transaction_reference TEXT NOT NULL,
  payment_proof_name TEXT,
  payment_proof_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_indiv_payments_user_email ON public.individual_payments(user_email);
CREATE INDEX IF NOT EXISTS idx_indiv_payments_status ON public.individual_payments(status);

-- ==============================================================================
-- 10. PAYMENT METHODS (Dynamic Admin Controlled Payment Receiving Configuration)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  payment_scope TEXT NOT NULL CHECK (payment_scope IN ('individual', 'school', 'both')),
  receiving_email TEXT,
  account_title TEXT,
  account_number TEXT,
  bank_name TEXT,
  iban TEXT,
  instructions TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed Payment Methods
INSERT INTO public.payment_methods (id, name, payment_scope, receiving_email, account_title, account_number, bank_name, iban, instructions, is_active)
VALUES
  ('pm_payoneer', 'Payoneer', 'individual', 'payments@playroomapp.com', 'Playroom Global Education LLC', NULL, 'Payoneer USD Receiving Account', NULL, 'Send payment via Payoneer to payments@playroomapp.com. Copy your Payoneer Transaction ID and enter it below with screenshot proof.', true),
  ('pm_sadapay', 'SadaPay', 'both', NULL, 'Playroom Education Services', '03001234567', 'SadaPay Microfinance Bank', 'PK00SADA00000003001234567', 'Transfer to SadaPay account 03001234567 (Playroom Education Services). Enter your 6-digit transaction ID and upload payment screenshot receipt.', true),
  ('pm_jazzcash', 'JazzCash', 'school', NULL, 'Playroom Education Services', '03009876543', 'JazzCash / Mobilink Microfinance Bank', NULL, 'Transfer fee via JazzCash app to 03009876543. Enter transaction ID (TID) and upload screenshot receipt.', true),
  ('pm_bank_transfer', 'Bank Transfer', 'both', NULL, 'Playroom Education Private Limited', '1234567890123456', 'Meezan Bank Ltd', 'PK90MEZN0012345678901234', 'Direct IBFT transfer to Meezan Bank, Account: 1234567890123456. Enter bank transaction reference number and upload receipt.', true)
ON CONFLICT (id) DO UPDATE SET
  receiving_email = EXCLUDED.receiving_email,
  account_title = EXCLUDED.account_title,
  account_number = EXCLUDED.account_number,
  bank_name = EXCLUDED.bank_name,
  iban = EXCLUDED.iban,
  instructions = EXCLUDED.instructions,
  is_active = EXCLUDED.is_active;

-- ==============================================================================
-- 11. CONTENT
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.content (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('activity', 'worksheet', 'rhyme', 'flashcard')),
  category TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 12. ADMIN SETTINGS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.admin_settings (
  id TEXT PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

INSERT INTO public.admin_settings (id, key, value)
VALUES
  ('as_school_default_limit', 'school_default_device_limit', '{"limit": 15}'::jsonb),
  ('as_pkr_usd_rate', 'pkr_usd_exchange_rate', '{"rate": 278}'::jsonb),
  ('as_general_contact', 'contact_support_email', '{"email": "support@playroomapp.com"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ==============================================================================
-- BACKWARDS COMPATIBILITY TABLES (Legacy aliases for existing code)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'one_level',
  level_number INTEGER,
  price_pkr NUMERIC(10,2) NOT NULL,
  price_usd NUMERIC(10,2) NOT NULL,
  duration_months INTEGER DEFAULT 1 NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  product_id TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('PKR', 'USD')),
  region TEXT NOT NULL DEFAULT 'pakistan',
  payment_method TEXT NOT NULL,
  transaction_reference TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.payments (
  id TEXT PRIMARY KEY,
  order_id TEXT,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  product_id TEXT,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('PKR', 'USD')),
  payment_method TEXT NOT NULL,
  provider_transaction_id TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'PENDING',
  payment_proof_name TEXT,
  payment_proof_url TEXT,
  verified_by TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  verified_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.user_licenses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_email TEXT,
  product_id TEXT,
  level INTEGER,
  all_activities_unlocked BOOLEAN DEFAULT false NOT NULL,
  start_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  expiry_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.school_licenses (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  allowed_devices INTEGER DEFAULT 15 NOT NULL,
  page1_access BOOLEAN DEFAULT true NOT NULL,
  page2_access BOOLEAN DEFAULT true NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('PKR', 'USD')),
  start_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  expiry_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  duration_months INTEGER DEFAULT 1 NOT NULL,
  payment_id TEXT,
  verified_by TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_email TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  admin_reply TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_email TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- STORED FUNCTIONS & PROCEDURES (RPCs)
-- ==============================================================================

-- 1. APPROVE INDIVIDUAL PAYMENT
CREATE OR REPLACE FUNCTION public.approve_individual_payment(
  p_payment_id TEXT,
  p_admin_id TEXT DEFAULT 'system_admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment RECORD;
  v_plan RECORD;
  v_duration_days INT := 30;
  v_access_lvl TEXT := 'full';
  v_start TIMESTAMPTZ := timezone('utc'::text, now());
  v_expiry TIMESTAMPTZ;
  v_purchase_id TEXT;
BEGIN
  -- Get payment record
  SELECT * INTO v_payment FROM public.individual_payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Individual payment record not found');
  END IF;

  -- Get plan if exists
  SELECT * INTO v_plan FROM public.plans WHERE id = v_payment.plan_id;
  IF FOUND AND v_plan.duration_days > 0 THEN
    v_duration_days := v_plan.duration_days;
  END IF;

  IF v_payment.selected_level IS NOT NULL THEN
    v_access_lvl := 'level_' || v_payment.selected_level;
  ELSE
    v_access_lvl := 'full';
  END IF;

  v_expiry := v_start + (v_duration_days || ' days')::interval;
  v_purchase_id := 'pur_' || gen_random_uuid()::text;

  -- Update payment status to approved
  UPDATE public.individual_payments
  SET
    status = 'approved',
    reviewed_by = p_admin_id,
    reviewed_at = v_start
  WHERE id = p_payment_id;

  -- Create active purchase record
  INSERT INTO public.purchases (
    id,
    user_id,
    user_email,
    product_id,
    plan_id,
    access_status,
    access_level,
    start_date,
    expiry_date,
    payment_status,
    payment_id
  ) VALUES (
    v_purchase_id,
    v_payment.user_id,
    v_payment.user_email,
    v_payment.plan_id,
    v_payment.plan_id,
    'active',
    v_access_lvl,
    v_start,
    v_expiry,
    'paid',
    p_payment_id
  );

  -- Create legacy user_license for backward compatibility
  INSERT INTO public.user_licenses (
    id,
    user_id,
    user_email,
    product_id,
    level,
    all_activities_unlocked,
    start_date,
    expiry_date,
    status,
    payment_id
  ) VALUES (
    'lic_' || gen_random_uuid()::text,
    v_payment.user_id,
    v_payment.user_email,
    v_payment.plan_id,
    v_payment.selected_level,
    (v_payment.selected_level IS NULL),
    v_start,
    v_expiry,
    'ACTIVE',
    p_payment_id
  );

  -- Notify user
  INSERT INTO public.notifications (
    id,
    user_id,
    user_email,
    type,
    title,
    message,
    read
  ) VALUES (
    'notif_' || gen_random_uuid()::text,
    v_payment.user_id,
    v_payment.user_email,
    'PAYMENT_APPROVED',
    'Payment Approved & Access Granted!',
    'Your payment of ' || v_payment.amount || ' ' || v_payment.currency || ' has been approved. Enjoy your 1-month full access to Playroom!',
    false
  );

  RETURN jsonb_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'expiry_date', v_expiry,
    'access_level', v_access_lvl
  );
END;
$$;

-- 2. REJECT INDIVIDUAL PAYMENT
CREATE OR REPLACE FUNCTION public.reject_individual_payment(
  p_payment_id TEXT,
  p_admin_id TEXT DEFAULT 'system_admin',
  p_admin_note TEXT DEFAULT 'Payment verification failed'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment RECORD;
BEGIN
  SELECT * INTO v_payment FROM public.individual_payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Individual payment record not found');
  END IF;

  UPDATE public.individual_payments
  SET
    status = 'rejected',
    admin_note = p_admin_note,
    reviewed_by = p_admin_id,
    reviewed_at = timezone('utc'::text, now())
  WHERE id = p_payment_id;

  INSERT INTO public.notifications (
    id,
    user_id,
    user_email,
    type,
    title,
    message,
    read
  ) VALUES (
    'notif_' || gen_random_uuid()::text,
    v_payment.user_id,
    v_payment.user_email,
    'PAYMENT_REJECTED',
    'Payment Verification Notice',
    'Your payment could not be verified: ' || p_admin_note,
    false
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 3. APPROVE SCHOOL PAYMENT
CREATE OR REPLACE FUNCTION public.approve_school_payment(
  p_payment_id TEXT,
  p_admin_id TEXT DEFAULT 'system_admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment RECORD;
  v_school RECORD;
  v_plan RECORD;
  v_duration_days INT := 30;
  v_start TIMESTAMPTZ := timezone('utc'::text, now());
  v_expiry TIMESTAMPTZ;
  v_dev_limit INT := 15;
BEGIN
  SELECT * INTO v_payment FROM public.school_payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'School payment record not found');
  END IF;

  SELECT * INTO v_school FROM public.schools WHERE id = v_payment.school_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'School not found');
  END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = v_payment.plan_id;
  IF FOUND AND v_plan.duration_days > 0 THEN
    v_duration_days := v_plan.duration_days;
  END IF;

  IF v_school.custom_device_limit IS NOT NULL AND v_school.custom_device_limit > 0 THEN
    v_dev_limit := v_school.custom_device_limit;
  ELSIF v_payment.device_limit > 0 THEN
    v_dev_limit := v_payment.device_limit;
  ELSE
    v_dev_limit := 15;
  END IF;

  v_expiry := v_start + (v_duration_days || ' days')::interval;

  -- Update payment status
  UPDATE public.school_payments
  SET
    status = 'approved',
    reviewed_by = p_admin_id,
    reviewed_at = v_start
  WHERE id = p_payment_id;

  -- Update school subscription and active status
  UPDATE public.schools
  SET
    status = 'ACTIVE',
    account_status = 'active',
    payment_status = 'paid',
    plan_id = v_payment.plan_id,
    device_limit = v_dev_limit,
    subscription_start = v_start,
    subscription_expiry = v_expiry,
    updated_at = v_start
  WHERE id = v_payment.school_id;

  -- Insert/update school license
  INSERT INTO public.school_licenses (
    id,
    school_id,
    allowed_devices,
    page1_access,
    page2_access,
    price,
    currency,
    start_date,
    expiry_date,
    status,
    duration_months,
    payment_id,
    verified_by
  ) VALUES (
    'sclic_' || gen_random_uuid()::text,
    v_payment.school_id,
    v_dev_limit,
    true,
    true,
    v_payment.amount,
    v_payment.currency,
    v_start,
    v_expiry,
    'ACTIVE',
    CEIL(v_duration_days / 30.0)::INT,
    p_payment_id,
    p_admin_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'school_id', v_payment.school_id,
    'device_limit', v_dev_limit,
    'subscription_expiry', v_expiry
  );
END;
$$;

-- 4. REJECT SCHOOL PAYMENT
CREATE OR REPLACE FUNCTION public.reject_school_payment(
  p_payment_id TEXT,
  p_admin_id TEXT DEFAULT 'system_admin',
  p_admin_note TEXT DEFAULT 'School payment verification failed'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.school_payments
  SET
    status = 'rejected',
    admin_note = p_admin_note,
    reviewed_by = p_admin_id,
    reviewed_at = timezone('utc'::text, now())
  WHERE id = p_payment_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 5. CAN REGISTER SCHOOL DEVICE (Checks device limit 15 or custom limit)
CREATE OR REPLACE FUNCTION public.can_register_school_device(
  p_school_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_school RECORD;
  v_current_count INT;
  v_max_limit INT := 15;
  v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
  SELECT * INTO v_school FROM public.schools WHERE id = p_school_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'School not found');
  END IF;

  -- Check subscription active
  IF v_school.account_status != 'active' OR v_school.payment_status != 'paid' OR (v_school.subscription_expiry IS NOT NULL AND v_school.subscription_expiry < v_now) THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'School subscription is inactive or expired. Please renew school license.',
      'school_name', v_school.school_name
    );
  END IF;

  -- Calculate max allowed limit
  IF v_school.custom_device_limit IS NOT NULL AND v_school.custom_device_limit > 0 THEN
    v_max_limit := v_school.custom_device_limit;
  ELSIF v_school.device_limit > 0 THEN
    v_max_limit := v_school.device_limit;
  ELSE
    v_max_limit := 15;
  END IF;

  -- Count currently active registered devices
  SELECT COUNT(*) INTO v_current_count
  FROM public.school_devices
  WHERE school_id = p_school_id AND is_active = true;

  IF v_current_count >= v_max_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'Device limit reached (' || v_current_count || ' of ' || v_max_limit || ' registered). Please contact admin or deactivate an unused device.',
      'current_count', v_current_count,
      'max_limit', v_max_limit
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'current_count', v_current_count,
    'max_limit', v_max_limit,
    'slots_remaining', v_max_limit - v_current_count,
    'school_name', v_school.school_name
  );
END;
$$;

-- 6. EXPIRE SUBSCRIPTIONS (Cron or manual trigger)
CREATE OR REPLACE FUNCTION public.expire_subscriptions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now TIMESTAMPTZ := timezone('utc'::text, now());
  v_expired_purchases INT := 0;
  v_expired_schools INT := 0;
BEGIN
  -- Expire individual purchases
  UPDATE public.purchases
  SET access_status = 'expired'
  WHERE access_status = 'active' AND expiry_date < v_now;
  GET DIAGNOSTICS v_expired_purchases = ROW_COUNT;

  -- Update expired schools
  UPDATE public.schools
  SET payment_status = 'unpaid', status = 'INACTIVE'
  WHERE status = 'ACTIVE' AND subscription_expiry IS NOT NULL AND subscription_expiry < v_now;
  GET DIAGNOSTICS v_expired_schools = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'expired_purchases', v_expired_purchases,
    'expired_schools', v_expired_schools
  );
END;
$$;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.individual_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Plans & Payment Methods: Public read
CREATE POLICY "Public can view active plans" ON public.plans FOR SELECT USING (true);
CREATE POLICY "Public can view active payment methods" ON public.payment_methods FOR SELECT USING (true);
CREATE POLICY "Public can view active content" ON public.content FOR SELECT USING (true);

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert/update own profile" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

-- Schools
CREATE POLICY "Public view schools" ON public.schools FOR SELECT USING (true);
CREATE POLICY "Public insert/update schools" ON public.schools FOR ALL USING (true) WITH CHECK (true);

-- Purchases
CREATE POLICY "Users can view own purchases" ON public.purchases FOR SELECT USING (true);
CREATE POLICY "Insert purchases" ON public.purchases FOR INSERT WITH CHECK (true);

-- School Devices
CREATE POLICY "Access school devices" ON public.school_devices FOR ALL USING (true) WITH CHECK (true);

-- School Request (Singular) & Requests (Plural)
CREATE POLICY "Access school request" ON public.school_request FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Access school requests" ON public.school_requests FOR ALL USING (true) WITH CHECK (true);

-- School Messages
CREATE POLICY "Access school messages" ON public.school_messages FOR ALL USING (true) WITH CHECK (true);

-- School Payments
CREATE POLICY "Access school payments" ON public.school_payments FOR ALL USING (true) WITH CHECK (true);

-- Individual Payments
CREATE POLICY "Access individual payments" ON public.individual_payments FOR ALL USING (true) WITH CHECK (true);

-- Admin Settings
CREATE POLICY "Access admin settings" ON public.admin_settings FOR ALL USING (true) WITH CHECK (true);
