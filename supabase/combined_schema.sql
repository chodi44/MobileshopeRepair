-- ============================================================
-- MP Repair — Complete Database Schema v2
-- Paste this ENTIRE script into Supabase SQL Editor → Run All
-- ============================================================

-- Roles enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'technician');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Users can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto-provision profile + role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE is_first BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN is_first THEN 'admin'::public.app_role ELSE 'staff'::public.app_role END);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Customers
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT,
  address TEXT,
  notes TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'en',
  photo_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
-- All staff can fully access all customers (shared shop account)
CREATE POLICY "Staff full access customers SELECT" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff full access customers INSERT" ON public.customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff full access customers UPDATE" ON public.customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Staff full access customers DELETE" ON public.customers FOR DELETE TO authenticated USING (true);

CREATE TRIGGER customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS customers_name_idx ON public.customers (name);
CREATE INDEX IF NOT EXISTS customers_phone_idx ON public.customers (phone);

-- Lock customer profile photo once set
CREATE OR REPLACE FUNCTION public.enforce_customer_photo_lock()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.photo_url IS NOT NULL AND NEW.photo_url IS DISTINCT FROM OLD.photo_url THEN
    RAISE EXCEPTION 'Customer profile photo is permanent and cannot be changed';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS customer_photo_lock ON public.customers;
CREATE TRIGGER customer_photo_lock
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_customer_photo_lock();

-- Repair status enum
DO $$ BEGIN
  CREATE TYPE public.repair_status AS ENUM (
    'received','diagnosing','awaiting_parts','repairing','ready','delivered','cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Daily ticket counter (YYMMDD-NN format)
CREATE TABLE IF NOT EXISTS public.ticket_daily_counters (
  day date PRIMARY KEY,
  last_no integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ticket_daily_counters TO service_role;
ALTER TABLE public.ticket_daily_counters ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.generate_ticket_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  n integer;
BEGIN
  INSERT INTO public.ticket_daily_counters(day, last_no)
  VALUES (d, 1)
  ON CONFLICT (day) DO UPDATE
    SET last_no = public.ticket_daily_counters.last_no + 1, updated_at = now()
  RETURNING last_no INTO n;
  IF n > 10000 THEN RAISE EXCEPTION 'Daily ticket limit reached'; END IF;
  RETURN to_char(d, 'YYMMDD') || '-' || lpad(n::text, 2, '0');
END;
$$;
REVOKE ALL ON FUNCTION public.generate_ticket_code() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.generate_ticket_code() TO authenticated;

-- Repair jobs
CREATE TABLE IF NOT EXISTS public.repair_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_code text NOT NULL UNIQUE DEFAULT public.generate_ticket_code(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  device_brand text NOT NULL,
  device_model text NOT NULL,
  device_color text,
  imei text,
  reported_issue text NOT NULL,
  status public.repair_status NOT NULL DEFAULT 'received',
  quoted_cost numeric(10,2),
  estimated_ready_at date,
  received_at timestamptz NOT NULL DEFAULT now(),
  assigned_to uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_reason text,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS repair_jobs_customer_idx ON public.repair_jobs(customer_id);
CREATE INDEX IF NOT EXISTS repair_jobs_status_idx ON public.repair_jobs(status);
CREATE INDEX IF NOT EXISTS repair_jobs_created_idx ON public.repair_jobs(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.repair_jobs TO authenticated;
GRANT SELECT ON public.repair_jobs TO anon;
GRANT ALL ON public.repair_jobs TO service_role;
ALTER TABLE public.repair_jobs ENABLE ROW LEVEL SECURITY;

-- Public tracking (no login)
CREATE POLICY "Public can lookup by ticket code" ON public.repair_jobs FOR SELECT TO anon USING (true);
-- All staff see and manage all jobs (shared shop)
CREATE POLICY "Staff full access repairs SELECT" ON public.repair_jobs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff full access repairs INSERT" ON public.repair_jobs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff full access repairs UPDATE" ON public.repair_jobs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Staff full access repairs DELETE" ON public.repair_jobs FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_repair_jobs_updated
  BEFORE UPDATE ON public.repair_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Delivered + soft-delete lock
CREATE OR REPLACE FUNCTION public.enforce_delivered_lock()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_TABLE_NAME = 'repair_jobs' THEN
    IF OLD.status = 'delivered' THEN
      IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
         OR NEW.deleted_reason IS DISTINCT FROM OLD.deleted_reason
         OR NEW.deleted_by IS DISTINCT FROM OLD.deleted_by THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'This repair is delivered and locked from edits';
    END IF;
  ELSIF TG_TABLE_NAME = 'repair_notes' THEN
    IF EXISTS (SELECT 1 FROM public.repair_jobs j WHERE j.id = COALESCE(NEW.job_id, OLD.job_id) AND j.status = 'delivered') THEN
      RAISE EXCEPTION 'This repair is delivered and locked from note changes';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_lock_delivered_jobs ON public.repair_jobs;
CREATE TRIGGER trg_lock_delivered_jobs
BEFORE UPDATE ON public.repair_jobs
FOR EACH ROW EXECUTE FUNCTION public.enforce_delivered_lock();

-- Repair notes
CREATE TABLE IF NOT EXISTS public.repair_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.repair_jobs(id) ON DELETE CASCADE,
  body text NOT NULL,
  is_public boolean NOT NULL DEFAULT false,
  author_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS repair_notes_job_idx ON public.repair_notes(job_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.repair_notes TO authenticated;
GRANT SELECT ON public.repair_notes TO anon;
GRANT ALL ON public.repair_notes TO service_role;
ALTER TABLE public.repair_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public sees only public notes" ON public.repair_notes FOR SELECT TO anon USING (is_public = true);
CREATE POLICY "Staff full access notes SELECT" ON public.repair_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff full access notes INSERT" ON public.repair_notes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff full access notes UPDATE" ON public.repair_notes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Staff full access notes DELETE" ON public.repair_notes FOR DELETE TO authenticated USING (true);

DROP TRIGGER IF EXISTS trg_lock_delivered_notes ON public.repair_notes;
CREATE TRIGGER trg_lock_delivered_notes
BEFORE INSERT OR UPDATE OR DELETE ON public.repair_notes
FOR EACH ROW EXECUTE FUNCTION public.enforce_delivered_lock();

-- Customer photo gallery
DO $$ BEGIN
  CREATE TYPE public.customer_photo_kind AS ENUM ('profile', 'intake', 'delivery', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.customer_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.repair_jobs(id) ON DELETE SET NULL,
  kind public.customer_photo_kind NOT NULL DEFAULT 'other',
  photo_path TEXT NOT NULL,
  note TEXT,
  taken_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_photos_customer_idx ON public.customer_photos(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS customer_photos_job_idx ON public.customer_photos(job_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_photos TO authenticated;
GRANT ALL ON public.customer_photos TO service_role;
ALTER TABLE public.customer_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff full access photos SELECT" ON public.customer_photos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff full access photos INSERT" ON public.customer_photos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff full access photos DELETE" ON public.customer_photos FOR DELETE TO authenticated USING (true);
