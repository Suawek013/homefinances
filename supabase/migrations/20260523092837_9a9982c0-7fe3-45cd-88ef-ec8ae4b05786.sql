CREATE TABLE public.category_budgets (
  category text PRIMARY KEY,
  amount numeric NOT NULL CHECK (amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.category_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "category_budgets open" ON public.category_budgets
  FOR ALL USING (true) WITH CHECK (true);