
-- Fix: Convert restrictive policies to PERMISSIVE for anonymous QR access

-- ==================== qr_codes ====================
DROP POLICY IF EXISTS "Anyone can lookup active QR tokens" ON public.qr_codes;
CREATE POLICY "Anyone can lookup active QR tokens"
ON public.qr_codes FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Keep owner policies as restrictive (they need auth)
-- No change needed for insert/update/delete

-- ==================== access_requests ====================
DROP POLICY IF EXISTS "Anyone can create access requests for active QR" ON public.access_requests;
CREATE POLICY "Anyone can create access requests for active QR"
ON public.access_requests FOR INSERT
TO anon, authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM qr_codes WHERE qr_codes.id = access_requests.qr_id AND qr_codes.is_active = true
));

DROP POLICY IF EXISTS "Anyone can view pending or approved requests" ON public.access_requests;
CREATE POLICY "Anyone can view pending or approved requests"
ON public.access_requests FOR SELECT
TO anon, authenticated
USING (status IN ('pending', 'approved', 'expired', 'rejected'));

-- Keep owner update policy unchanged

-- ==================== access_logs ====================
DROP POLICY IF EXISTS "Allow insert access logs for authenticated users" ON public.access_logs;
CREATE POLICY "Anyone can insert access logs for valid requests"
ON public.access_logs FOR INSERT
TO anon, authenticated
WITH CHECK (
  owner_id IS NOT NULL AND (
    auth.uid() = owner_id OR
    EXISTS (SELECT 1 FROM access_requests ar WHERE ar.id = access_logs.request_id)
  )
);

-- ==================== qr_code_documents ====================
DROP POLICY IF EXISTS "Anyone can read qr_code_documents for active QR" ON public.qr_code_documents;
CREATE POLICY "Anyone can read qr_code_documents for active QR"
ON public.qr_code_documents FOR SELECT
TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM qr_codes WHERE qr_codes.id = qr_code_documents.qr_id AND qr_codes.is_active = true
));
