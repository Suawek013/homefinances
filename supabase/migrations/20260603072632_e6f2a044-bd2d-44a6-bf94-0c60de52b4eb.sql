INSERT INTO public.investment_snapshots (household_id, user_id, label, value, recorded_on, created_at)
SELECT household_id, user_id, COALESCE(label, ''), amount, occurred_on, created_at
FROM public.savings_entries;

DROP TABLE public.savings_entries;