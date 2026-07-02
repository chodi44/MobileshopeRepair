
-- Photo kinds
DO $$ BEGIN
  CREATE TYPE public.customer_photo_kind AS ENUM ('profile', 'intake', 'delivery', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Gallery table
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

CREATE POLICY "Staff can view customer photos"
  ON public.customer_photos FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Staff can add customer photos"
  ON public.customer_photos FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can delete customer photos"
  ON public.customer_photos FOR DELETE
  TO authenticated USING (auth.uid() IS NOT NULL);

-- Lock the customer profile photo once set: photo_url may go from NULL -> value, but not change afterwards
CREATE OR REPLACE FUNCTION public.enforce_customer_photo_lock()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.photo_url IS NOT NULL
     AND NEW.photo_url IS DISTINCT FROM OLD.photo_url THEN
    RAISE EXCEPTION 'Customer profile photo is permanent and cannot be changed';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS customer_photo_lock ON public.customers;
CREATE TRIGGER customer_photo_lock
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_customer_photo_lock();

-- Storage RLS for the existing customer-photos bucket (private): allow staff full access
DO $$ BEGIN
  CREATE POLICY "Staff read customer-photos"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'customer-photos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Staff upload customer-photos"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'customer-photos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Staff delete customer-photos"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'customer-photos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
