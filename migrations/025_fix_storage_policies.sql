-- ============================================================================
-- Migration 025: Fix storage policies for the 'documents' bucket
-- ============================================================================
-- The CMS contract upload fails because authenticated users don't have
-- INSERT permission on the storage.objects table for the 'documents' bucket.
-- Add policies for authenticated users to upload and read from 'documents'.
-- ============================================================================

-- Allow authenticated users to upload to the documents bucket
CREATE POLICY "documents_insert_authenticated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- Allow authenticated users to update (upsert) in the documents bucket
CREATE POLICY "documents_update_authenticated"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'documents');

-- Allow anyone to read from the documents bucket (it's public)
CREATE POLICY "documents_select_public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'documents');

-- Allow authenticated users to delete their uploads
CREATE POLICY "documents_delete_authenticated"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'documents');
