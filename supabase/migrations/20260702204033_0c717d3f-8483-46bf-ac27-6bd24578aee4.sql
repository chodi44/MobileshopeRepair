
CREATE TABLE IF NOT EXISTS public.ticket_daily_counters (
  day date PRIMARY KEY,
  last_no integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.ticket_daily_counters TO service_role;
ALTER TABLE public.ticket_daily_counters ENABLE ROW LEVEL SECURITY;
-- No policies: only the SECURITY DEFINER function touches this table.

CREATE OR REPLACE FUNCTION public.generate_ticket_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  n integer;
BEGIN
  INSERT INTO public.ticket_daily_counters(day, last_no)
  VALUES (d, 1)
  ON CONFLICT (day) DO UPDATE
    SET last_no = public.ticket_daily_counters.last_no + 1,
        updated_at = now()
  RETURNING last_no INTO n;

  IF n > 10000 THEN
    RAISE EXCEPTION 'Daily ticket limit (10000) reached for %', d;
  END IF;

  RETURN to_char(d, 'YYMMDD') || '-' || lpad(n::text, 2, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.generate_ticket_code() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.generate_ticket_code() TO authenticated;
