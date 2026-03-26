
ALTER TABLE public.documents 
  ADD COLUMN IF NOT EXISTS ai_extracted_text text,
  ADD COLUMN IF NOT EXISTS ai_classification text,
  ADD COLUMN IF NOT EXISTS ai_enhanced boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_processing_status text NOT NULL DEFAULT 'pending';
