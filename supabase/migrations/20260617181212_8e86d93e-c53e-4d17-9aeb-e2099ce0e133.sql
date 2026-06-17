-- Lock down storage.objects for the private 'receipts' bucket.
-- All app access is performed server-side via the service role (which bypasses RLS)
-- and clients only ever receive short-lived signed URLs. We therefore deny all
-- direct client (anon/authenticated) access to objects in this bucket.

DROP POLICY IF EXISTS "receipts deny select" ON storage.objects;
DROP POLICY IF EXISTS "receipts deny insert" ON storage.objects;
DROP POLICY IF EXISTS "receipts deny update" ON storage.objects;
DROP POLICY IF EXISTS "receipts deny delete" ON storage.objects;

CREATE POLICY "receipts deny select"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id <> 'receipts');

CREATE POLICY "receipts deny insert"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id <> 'receipts');

CREATE POLICY "receipts deny update"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id <> 'receipts')
WITH CHECK (bucket_id <> 'receipts');

CREATE POLICY "receipts deny delete"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id <> 'receipts');
