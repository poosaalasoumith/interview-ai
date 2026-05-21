-- ========================================================
-- InterviewAI Supabase Storage Migration
-- Version: 20260521100000_profile_avatars_storage
-- Safe, Idempotent and Non-Destructive Storage Setup
-- ========================================================

-- 1. Create the 'avatars' storage bucket if it does not exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 
  'avatars', 
  true, 
  2097152, -- 2MB limit
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- 2. Enable Row-Level Security (RLS) on storage.objects
-- Note: Supabase enables RLS on storage.objects by default, but this ensures it is active
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Storage RLS Policies for the 'avatars' bucket

-- Policy A: Allow public read access to all files inside the 'avatars' bucket so avatars render in dashboards and headers
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
CREATE POLICY "Public Read Access" 
  ON storage.objects FOR SELECT 
  USING (bucket_id = 'avatars');

-- Policy B: Allow authenticated users to upload files to their own folder (folder name equals auth.uid()::text)
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
CREATE POLICY "Authenticated Upload" 
  ON storage.objects FOR INSERT 
  TO authenticated 
  WITH CHECK (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy C: Allow users to update their own uploaded avatars
DROP POLICY IF EXISTS "Owner Update Access" ON storage.objects;
CREATE POLICY "Owner Update Access" 
  ON storage.objects FOR UPDATE 
  TO authenticated 
  USING (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy D: Allow users to delete their own uploaded avatars
DROP POLICY IF EXISTS "Owner Delete Access" ON storage.objects;
CREATE POLICY "Owner Delete Access" 
  ON storage.objects FOR DELETE 
  TO authenticated 
  USING (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
