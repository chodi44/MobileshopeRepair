
ALTER TABLE public.repair_jobs
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_reason text,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS repair_jobs_deleted_at_idx ON public.repair_jobs (deleted_at);

-- Allow soft-delete update even on delivered rows; still block other edits when delivered.
CREATE OR REPLACE FUNCTION public.enforce_delivered_lock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_TABLE_NAME = 'repair_jobs' THEN
    IF OLD.status = 'delivered' THEN
      -- Permit only soft-delete field updates on a delivered row
      IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
         OR NEW.deleted_reason IS DISTINCT FROM OLD.deleted_reason
         OR NEW.deleted_by IS DISTINCT FROM OLD.deleted_by THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'This repair is delivered and locked from edits';
    END IF;
  ELSIF TG_TABLE_NAME = 'repair_notes' THEN
    IF EXISTS (
      SELECT 1 FROM public.repair_jobs j
      WHERE j.id = COALESCE(NEW.job_id, OLD.job_id) AND j.status = 'delivered'
    ) THEN
      RAISE EXCEPTION 'This repair is delivered and locked from note changes';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $function$;
