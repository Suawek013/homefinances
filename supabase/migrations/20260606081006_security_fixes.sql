-- Restrict client-side INSERTs on household_members; all inserts happen via service_role server functions
CREATE POLICY "deny client inserts on household_members"
ON public.household_members
FOR INSERT
TO authenticated
WITH CHECK (false);

-- Lock down receipts storage bucket; all reads/writes happen via service_role server functions (signed URLs for downloads)
CREATE POLICY "deny client select on receipts bucket"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'receipts' AND false);

CREATE POLICY "deny client insert on receipts bucket"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'receipts' AND false);

CREATE POLICY "deny client update on receipts bucket"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'receipts' AND false);

CREATE POLICY "deny client delete on receipts bucket"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'receipts' AND false);
