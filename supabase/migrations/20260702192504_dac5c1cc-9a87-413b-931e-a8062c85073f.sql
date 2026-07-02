
-- Sequential ticket codes
CREATE SEQUENCE IF NOT EXISTS public.repair_ticket_seq START 1;
GRANT USAGE, SELECT ON SEQUENCE public.repair_ticket_seq TO authenticated, service_role;

-- Seed sequence past existing max numeric ticket if any
DO $$
DECLARE
  m bigint;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(ticket_code, '\D', '', 'g'), '')::bigint), 0)
    INTO m FROM public.repair_jobs;
  IF m > 0 THEN
    PERFORM setval('public.repair_ticket_seq', m);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.generate_ticket_code()
RETURNS text
LANGUAGE sql
SET search_path = public
AS $$
  SELECT nextval('public.repair_ticket_seq')::text;
$$;

GRANT EXECUTE ON FUNCTION public.generate_ticket_code() TO authenticated;

-- Lock delivered repairs (no updates, no note changes)
CREATE OR REPLACE FUNCTION public.enforce_delivered_lock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'repair_jobs' THEN
    IF OLD.status = 'delivered' THEN
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

DROP TRIGGER IF EXISTS trg_lock_delivered_notes ON public.repair_notes;
CREATE TRIGGER trg_lock_delivered_notes
BEFORE INSERT OR UPDATE OR DELETE ON public.repair_notes
FOR EACH ROW EXECUTE FUNCTION public.enforce_delivered_lock();
