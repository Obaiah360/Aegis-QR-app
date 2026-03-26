-- ===== COMBINED MIGRATION FOR SECUREDOCS =====
-- Run this entire script in your Supabase SQL Editor at:
-- https://supabase.com/dashboard/project/cpsseharpliknqjppzow/sql/new

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==================== ADD SIGNED URLS COLUMN TO ACCESS REQUESTS ====================
ALTER TABLE public.access_requests ADD COLUMN IF NOT EXISTS signed_document_urls JSONB;


CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  two_fa_enabled BOOLEAN NOT NULL DEFAULT false,
  emergency_mode_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ==================== DOCUMENTS ====================
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  is_emergency_accessible BOOLEAN NOT NULL DEFAULT false,
  ai_extracted_text TEXT,
  ai_classification TEXT,
  ai_enhanced BOOLEAN NOT NULL DEFAULT false,
  ai_processing_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;
CREATE POLICY "Users can view own documents" ON public.documents FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert own documents" ON public.documents FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own documents" ON public.documents FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own documents" ON public.documents FOR DELETE USING (auth.uid() = owner_id);

-- ==================== QR CODES ====================
CREATE TABLE IF NOT EXISTS public.qr_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  label TEXT NOT NULL DEFAULT 'My QR',
  profile_type TEXT NOT NULL DEFAULT 'general',
  is_active BOOLEAN NOT NULL DEFAULT true,
  access_count INTEGER NOT NULL DEFAULT 0,
  time_limit_seconds INTEGER NOT NULL DEFAULT 300,
  download_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own QR codes" ON public.qr_codes;
DROP POLICY IF EXISTS "Users can insert own QR codes" ON public.qr_codes;
DROP POLICY IF EXISTS "Users can update own QR codes" ON public.qr_codes;
DROP POLICY IF EXISTS "Users can delete own QR codes" ON public.qr_codes;
DROP POLICY IF EXISTS "Anyone can lookup active QR tokens" ON public.qr_codes;
CREATE POLICY "Users can view own QR codes" ON public.qr_codes FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert own QR codes" ON public.qr_codes FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own QR codes" ON public.qr_codes FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own QR codes" ON public.qr_codes FOR DELETE USING (auth.uid() = owner_id);
CREATE POLICY "Anyone can lookup active QR tokens" ON public.qr_codes FOR SELECT TO anon, authenticated USING (is_active = true);

-- ==================== ACCESS REQUESTS ====================
CREATE TABLE IF NOT EXISTS public.access_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  qr_id UUID NOT NULL REFERENCES public.qr_codes(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_ip TEXT,
  requester_device TEXT,
  requester_location TEXT,
  requester_name TEXT,
  requester_purpose TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  access_token TEXT UNIQUE,
  approved_document_ids UUID[],
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners can view requests for their QR codes" ON public.access_requests;
DROP POLICY IF EXISTS "Owners can update request status" ON public.access_requests;
DROP POLICY IF EXISTS "Anyone can create access requests for active QR" ON public.access_requests;
DROP POLICY IF EXISTS "Anyone can view pending or approved requests" ON public.access_requests;
CREATE POLICY "Owners can view requests for their QR codes" ON public.access_requests FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Owners can update request status" ON public.access_requests FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Anyone can create access requests for active QR" ON public.access_requests FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM qr_codes WHERE qr_codes.id = access_requests.qr_id AND qr_codes.is_active = true));
CREATE POLICY "Anyone can view pending or approved requests" ON public.access_requests FOR SELECT TO anon, authenticated
  USING (status IN ('pending', 'approved', 'expired', 'rejected'));

-- ==================== ACCESS LOGS ====================
CREATE TABLE IF NOT EXISTS public.access_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id UUID REFERENCES public.access_requests(id) ON DELETE SET NULL,
  qr_id UUID REFERENCES public.qr_codes(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  requester_ip TEXT,
  requester_device TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own access logs" ON public.access_logs;
DROP POLICY IF EXISTS "Anyone can insert access logs for valid requests" ON public.access_logs;
CREATE POLICY "Users can view own access logs" ON public.access_logs FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Anyone can insert access logs for valid requests" ON public.access_logs FOR INSERT TO anon, authenticated
  WITH CHECK (owner_id IS NOT NULL AND (auth.uid() = owner_id OR EXISTS (SELECT 1 FROM access_requests ar WHERE ar.id = access_logs.request_id)));

-- ==================== QR CODE DOCUMENTS (join table) ====================
CREATE TABLE IF NOT EXISTS public.qr_code_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  qr_id UUID NOT NULL REFERENCES public.qr_codes(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(qr_id, document_id)
);
ALTER TABLE public.qr_code_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners can manage qr_code_documents" ON public.qr_code_documents;
DROP POLICY IF EXISTS "Anyone can read qr_code_documents for active QR" ON public.qr_code_documents;
CREATE POLICY "Owners can manage qr_code_documents" ON public.qr_code_documents FOR ALL
  USING (EXISTS (SELECT 1 FROM public.qr_codes WHERE qr_codes.id = qr_code_documents.qr_id AND qr_codes.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.qr_codes WHERE qr_codes.id = qr_code_documents.qr_id AND qr_codes.owner_id = auth.uid()));
CREATE POLICY "Anyone can read qr_code_documents for active QR" ON public.qr_code_documents FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM qr_codes WHERE qr_codes.id = qr_code_documents.qr_id AND qr_codes.is_active = true));

-- ==================== STORAGE BUCKET ====================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documents', 'documents', false, 52428800, ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];

DROP POLICY IF EXISTS "Users can upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own documents storage" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own documents storage" ON storage.objects;

CREATE POLICY "Users can upload own documents" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own documents storage" ON storage.objects FOR SELECT
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own documents storage" ON storage.objects FOR DELETE
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ==================== TRIGGERS ====================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_qr_codes_updated_at ON public.qr_codes;
CREATE TRIGGER update_qr_codes_updated_at BEFORE UPDATE ON public.qr_codes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_access_requests_updated_at ON public.access_requests;
CREATE TRIGGER update_access_requests_updated_at BEFORE UPDATE ON public.access_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==================== REALTIME ====================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'access_requests') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.access_requests;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'qr_codes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.qr_codes;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'qr_code_documents') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.qr_code_documents;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
