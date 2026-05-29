-- Monthly incomes (e.g. variable salaries)
CREATE TABLE public.monthly_incomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  year_month text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, user_id, year_month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_incomes TO authenticated;
GRANT ALL ON public.monthly_incomes TO service_role;

ALTER TABLE public.monthly_incomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household members manage monthly_incomes"
ON public.monthly_incomes FOR ALL TO authenticated
USING (is_household_member(household_id))
WITH CHECK (is_household_member(household_id));

-- Savings entries (signed amount = deposit/withdrawal). Balance = SUM(amount) per user.
CREATE TABLE public.savings_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  label text NOT NULL DEFAULT '',
  occurred_on date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_entries TO authenticated;
GRANT ALL ON public.savings_entries TO service_role;

ALTER TABLE public.savings_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household members manage savings_entries"
ON public.savings_entries FOR ALL TO authenticated
USING (is_household_member(household_id))
WITH CHECK (is_household_member(household_id));

CREATE INDEX idx_savings_entries_hh_user ON public.savings_entries(household_id, user_id);
CREATE INDEX idx_monthly_incomes_hh_month ON public.monthly_incomes(household_id, year_month);