CREATE TABLE public.custom_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id uuid NOT NULL,
  label text NOT NULL,
  color text NOT NULL DEFAULT 'oklch(0.6 0.03 200)',
  icon text NOT NULL DEFAULT 'Package',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (household_id, label)
);

ALTER TABLE public.custom_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household members manage custom_categories"
ON public.custom_categories
FOR ALL
TO authenticated
USING (public.is_household_member(household_id))
WITH CHECK (public.is_household_member(household_id));
