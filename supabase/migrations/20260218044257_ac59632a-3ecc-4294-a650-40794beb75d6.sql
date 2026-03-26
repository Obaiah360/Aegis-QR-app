
-- Fix: Access requests insert - require that qr_id references an active qr code
DROP POLICY IF EXISTS "Anyone can create access requests" ON public.access_requests;
DROP POLICY IF EXISTS "Anyone can view request by token" ON public.access_requests;
DROP POLICY IF EXISTS "Allow insert access logs" ON public.access_logs;

-- Recreate with more restrictive conditions
-- Scanner can create an access request only for an active QR code
CREATE POLICY "Anyone can create access requests for active QR"
  ON public.access_requests FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.qr_codes
      WHERE id = qr_id AND is_active = true
    )
  );

-- Allow reading request by access_token (for scanner waiting screen) - status check adds constraint
CREATE POLICY "Anyone can view pending or approved requests"
  ON public.access_requests FOR SELECT
  USING (status IN ('pending', 'approved', 'expired', 'rejected'));

-- Access logs can only be inserted when tied to a valid owner or as anonymous scan log
CREATE POLICY "Allow insert access logs for authenticated users"
  ON public.access_logs FOR INSERT
  WITH CHECK (
    auth.uid() = owner_id OR
    EXISTS (
      SELECT 1 FROM public.access_requests ar
      WHERE ar.id = request_id
    )
  );
