
TRUNCATE TABLE public.expenses, public.recurring_instances, public.recurring_expenses,
  public.receipts, public.category_budgets RESTART IDENTITY CASCADE;
DELETE FROM public.settings;
DROP TABLE IF EXISTS public.people CASCADE;

CREATE TABLE public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'My household',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.household_members (
  user_id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  color text NOT NULL DEFAULT 'oklch(0.55 0.11 200)',
  joined_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX household_members_household_idx ON public.household_members(household_id);
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.household_invites (
  code text PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at timestamptz,
  used_by uuid
);
CREATE INDEX household_invites_household_idx ON public.household_invites(household_id);
ALTER TABLE public.household_invites ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_household_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_household_member(_household_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE user_id = auth.uid() AND household_id = _household_id
  )
$$;

ALTER TABLE public.expenses
  DROP COLUMN person_id,
  ADD COLUMN household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  ADD COLUMN user_id uuid NOT NULL;
CREATE INDEX expenses_household_spent_on_idx ON public.expenses(household_id, spent_on DESC);

ALTER TABLE public.recurring_expenses
  DROP COLUMN person_id,
  ADD COLUMN household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  ADD COLUMN user_id uuid NOT NULL;
CREATE INDEX recurring_expenses_household_idx ON public.recurring_expenses(household_id);

ALTER TABLE public.recurring_instances
  ADD COLUMN household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE public.receipts
  DROP COLUMN person_id,
  ADD COLUMN household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  ADD COLUMN user_id uuid NOT NULL;
CREATE INDEX receipts_household_idx ON public.receipts(household_id);

DROP TABLE IF EXISTS public.settings;
CREATE TABLE public.household_settings (
  household_id uuid PRIMARY KEY REFERENCES public.households(id) ON DELETE CASCADE,
  monthly_budget numeric,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.household_settings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.category_budgets DROP CONSTRAINT IF EXISTS category_budgets_pkey;
ALTER TABLE public.category_budgets
  ADD COLUMN household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE;
ALTER TABLE public.category_budgets ADD PRIMARY KEY (household_id, category);

DROP POLICY IF EXISTS "expenses open" ON public.expenses;
DROP POLICY IF EXISTS "recurring open" ON public.recurring_expenses;
DROP POLICY IF EXISTS "recurring_instances open" ON public.recurring_instances;
DROP POLICY IF EXISTS "receipts open" ON public.receipts;
DROP POLICY IF EXISTS "category_budgets open" ON public.category_budgets;

CREATE POLICY "household members manage expenses" ON public.expenses FOR ALL TO authenticated
  USING (public.is_household_member(household_id)) WITH CHECK (public.is_household_member(household_id));
CREATE POLICY "household members manage recurring" ON public.recurring_expenses FOR ALL TO authenticated
  USING (public.is_household_member(household_id)) WITH CHECK (public.is_household_member(household_id));
CREATE POLICY "household members manage recurring_instances" ON public.recurring_instances FOR ALL TO authenticated
  USING (public.is_household_member(household_id)) WITH CHECK (public.is_household_member(household_id));
CREATE POLICY "household members manage receipts" ON public.receipts FOR ALL TO authenticated
  USING (public.is_household_member(household_id)) WITH CHECK (public.is_household_member(household_id));
CREATE POLICY "household members manage category_budgets" ON public.category_budgets FOR ALL TO authenticated
  USING (public.is_household_member(household_id)) WITH CHECK (public.is_household_member(household_id));
CREATE POLICY "household members manage settings" ON public.household_settings FOR ALL TO authenticated
  USING (public.is_household_member(household_id)) WITH CHECK (public.is_household_member(household_id));

CREATE POLICY "members can view their household" ON public.households FOR SELECT TO authenticated
  USING (public.is_household_member(id));
CREATE POLICY "anyone authenticated can create a household" ON public.households FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "members can update their household" ON public.households FOR UPDATE TO authenticated
  USING (public.is_household_member(id)) WITH CHECK (public.is_household_member(id));

CREATE POLICY "members can view co-members" ON public.household_members FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));
CREATE POLICY "user can insert self as member" ON public.household_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "user can update self member row" ON public.household_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "user can leave household" ON public.household_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "view invites of own household or any unused code" ON public.household_invites FOR SELECT TO authenticated
  USING (public.is_household_member(household_id) OR used_at IS NULL);
CREATE POLICY "members create invites" ON public.household_invites FOR INSERT TO authenticated
  WITH CHECK (public.is_household_member(household_id) AND created_by = auth.uid());
CREATE POLICY "members delete own household invites" ON public.household_invites FOR DELETE TO authenticated
  USING (public.is_household_member(household_id));
