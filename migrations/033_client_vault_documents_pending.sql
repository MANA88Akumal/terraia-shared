-- 033: Allow pending client vault documents (no file uploaded yet)
-- TerraIA Platform — Client Portal
--
-- The Documents page in client-portal needs to display rows that are
-- "Pending" (created by an admin as a placeholder) before the actual
-- file has been uploaded. Making file_url nullable enables that.
-- Existing RLS policy (vault_client_read) already scopes by client user
-- and case_id — no changes needed there.

ALTER TABLE client_vault_documents
  ALTER COLUMN file_url DROP NOT NULL;

COMMENT ON COLUMN client_vault_documents.file_url IS
  'Storage path in the `documents` bucket OR a full http(s) URL. NULL means the document has been announced to the client but not yet uploaded — UI renders a Pending badge.';

NOTIFY pgrst, 'reload schema';
