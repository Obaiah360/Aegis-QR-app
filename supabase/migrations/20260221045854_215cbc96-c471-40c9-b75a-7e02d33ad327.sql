
-- Allow anon to read qr_code_documents for active QR codes
DROP POLICY IF EXISTS "Anyone can read qr_code_documents for active QR" ON public.qr_code_documents;
CREATE POLICY "Anyone can read qr_code_documents for active QR"
ON public.qr_code_documents FOR SELECT
TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM qr_codes WHERE qr_codes.id = qr_code_documents.qr_id AND qr_codes.is_active = true
));
