
-- Enum for repair status
CREATE TYPE public.repair_status AS ENUM (
  'received','diagnosing','awaiting_parts','repairing','ready','delivered','cancelled'
);

-- Short random ticket code generator (e.g. FX-8FQ2K)
CREATE OR REPLACE FUNCTION public.generate_ticket_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
BEGIN
  LOOP
    code := 'FX-';
    FOR i IN 1..6 LOOP
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.repair_jobs WHERE ticket_code = code);
  END LOOP;
  RETURN code;
END;
$$;

-- repair_jobs table
CREATE TABLE public.repair_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_code text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  device_brand text NOT NULL,
  device_model text NOT NULL,
  device_color text,
  imei text,
  reported_issue text NOT NULL,
  status public.repair_status NOT NULL DEFAULT 'received',
  quoted_cost numeric(10,2),
  estimated_ready_at date,
  assigned_to uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.repair_jobs
  ALTER COLUMN ticket_code SET DEFAULT public.generate_ticket_code();

CREATE INDEX repair_jobs_customer_idx ON public.repair_jobs(customer_id);
CREATE INDEX repair_jobs_status_idx ON public.repair_jobs(status);
CREATE INDEX repair_jobs_created_idx ON public.repair_jobs(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.repair_jobs TO authenticated;
GRANT SELECT ON public.repair_jobs TO anon; -- public tracking lookup by ticket_code
GRANT ALL ON public.repair_jobs TO service_role;

ALTER TABLE public.repair_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can lookup by ticket code"
  ON public.repair_jobs FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Authenticated view repair jobs"
  ON public.repair_jobs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated insert repair jobs"
  ON public.repair_jobs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator or admin updates repair jobs"
  ON public.repair_jobs FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete repair jobs"
  ON public.repair_jobs FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_repair_jobs_updated
  BEFORE UPDATE ON public.repair_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- repair_notes table
CREATE TABLE public.repair_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.repair_jobs(id) ON DELETE CASCADE,
  body text NOT NULL,
  is_public boolean NOT NULL DEFAULT false,
  author_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX repair_notes_job_idx ON public.repair_notes(job_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.repair_notes TO authenticated;
GRANT SELECT ON public.repair_notes TO anon; -- but policy restricts to is_public
GRANT ALL ON public.repair_notes TO service_role;

ALTER TABLE public.repair_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public sees only public notes"
  ON public.repair_notes FOR SELECT
  TO anon
  USING (is_public = true);

CREATE POLICY "Authenticated view all notes"
  ON public.repair_notes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated insert notes"
  ON public.repair_notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Author or admin updates note"
  ON public.repair_notes FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Author or admin deletes note"
  ON public.repair_notes FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));
