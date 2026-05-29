-- Change recurring_instances.expense_id FK to cascade on expense delete,
-- so deleting an expense also removes its recurring instance (reverting to pending).
ALTER TABLE public.recurring_instances
  DROP CONSTRAINT recurring_instances_expense_id_fkey;

ALTER TABLE public.recurring_instances
  ADD CONSTRAINT recurring_instances_expense_id_fkey
  FOREIGN KEY (expense_id) REFERENCES public.expenses(id) ON DELETE CASCADE;

-- Clean up orphaned instances whose expense was already deleted (expense_id is NULL).
DELETE FROM public.recurring_instances WHERE expense_id IS NULL;