CREATE TABLE public.investment_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id uuid NOT NULL,
  user_id uuid NOT NULL,
  label text NOT NULL DEFAULT '',
  value numeric NOT NULL,
  recorded_on date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.investment_snapshots TO authenticated;
GRANT ALL ON public.investment_snapshots TO service_role;

ALTER TABLE public.investment_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household members manage investment_snapshots"
ON public.investment_snapshots
FOR ALL
TO authenticated
USING (is_household_member(household_id))
WITH CHECK (is_household_member(household_id));

CREATE INDEX idx_investment_snapshots_lookup
ON public.investment_snapshots (household_id, user_id, label, recorded_on DESC);