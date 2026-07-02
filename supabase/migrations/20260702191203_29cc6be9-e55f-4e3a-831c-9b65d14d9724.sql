
CREATE POLICY "Authenticated can read customer photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'customer-photos');

CREATE POLICY "Authenticated can upload customer photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'customer-photos');

CREATE POLICY "Authenticated can update customer photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'customer-photos');

CREATE POLICY "Authenticated can delete customer photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'customer-photos');
