
-- 1) Restrict household_invites SELECT to members only
DROP POLICY IF EXISTS "view invites of own household or any unused code" ON public.household_invites;
CREATE POLICY "members view own household invites"
ON public.household_invites
FOR SELECT
TO authenticated
USING (is_household_member(household_id));

-- 2) Make receipts bucket private
UPDATE storage.buckets SET public = false WHERE id = 'receipts';

-- 3) Revoke execute from anon on internal RLS helper functions
REVOKE EXECUTE ON FUNCTION public.current_household_id() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_household_member(uuid) FROM anon, public;
-- Keep authenticated execute since RLS policies depend on these helpers
GRANT EXECUTE ON FUNCTION public.is_household_member(uuid) TO authenticated;
