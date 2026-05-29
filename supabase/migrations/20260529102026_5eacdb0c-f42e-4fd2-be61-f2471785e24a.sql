-- Fix PRIVILEGE_ESCALATION: prevent users from directly adding themselves to arbitrary households.
-- Membership creation is performed server-side via service role (createHousehold / joinHouseholdByCode),
-- so direct INSERT from authenticated role is unnecessary and unsafe.
DROP POLICY IF EXISTS "user can insert self as member" ON public.household_members;

-- Fix EXPOSED_SENSITIVE_DATA: receipts bucket is private and all storage operations
-- happen server-side via the service role with signed URLs. Remove the permissive
-- public-role policies that exposed read/write/delete on objects to anyone.
DROP POLICY IF EXISTS "receipts bucket read" ON storage.objects;
DROP POLICY IF EXISTS "receipts bucket insert" ON storage.objects;
DROP POLICY IF EXISTS "receipts bucket update" ON storage.objects;
DROP POLICY IF EXISTS "receipts bucket delete" ON storage.objects;