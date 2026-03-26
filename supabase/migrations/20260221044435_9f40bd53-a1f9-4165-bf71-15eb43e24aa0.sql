
-- 1. Add time_limit_seconds to qr_codes if missing
ALTER TABLE public.qr_codes 
  ADD COLUMN IF NOT EXISTS time_limit_seconds INTEGER NOT NULL DEFAULT 300;

-- 2. Create qr_code_documents join table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.qr_code_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  qr_id UUID NOT NULL REFERENCES public.qr_codes(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(qr_id, document_id)
);

-- 3. Enable RLS on qr_code_documents
ALTER TABLE public.qr_code_documents ENABLE ROW LEVEL SECURITY;

-- 4. RLS: owners can manage their QR-doc links
DROP POLICY IF EXISTS "Owners can manage qr_code_documents" ON public.qr_code_documents;
CREATE POLICY "Owners can manage qr_code_documents"
  ON public.qr_code_documents
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.qr_codes
      WHERE qr_codes.id = qr_code_documents.qr_id
        AND qr_codes.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.qr_codes
      WHERE qr_codes.id = qr_code_documents.qr_id
        AND qr_codes.owner_id = auth.uid()
    )
  );

-- 5. RLS: anyone can read qr_code_documents (needed for edge function via service role - no anon reads needed)
-- Edge function uses service role so no anon select policy needed.

-- 6. Enable realtime for qr_code_documents
ALTER PUBLICATION supabase_realtime ADD TABLE public.qr_code_documents;

-- 7. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
