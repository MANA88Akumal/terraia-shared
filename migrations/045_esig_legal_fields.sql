-- 045: Mexican legal compliance fields on esig_signers
-- Adds optional RFC (Registro Federal de Contribuyentes), tracked consent
-- text version, and the timezone the signer was in when they signed.
-- None of these are required, but capturing them when available strengthens
-- the legal weight of the signature under Código de Comercio Art. 89-114.

ALTER TABLE esig_signers
  ADD COLUMN IF NOT EXISTS rfc TEXT,
  ADD COLUMN IF NOT EXISTS consent_language_version TEXT,
  ADD COLUMN IF NOT EXISTS signed_timezone TEXT,
  ADD COLUMN IF NOT EXISTS consent_text TEXT;

-- Companion columns on the document: who the firma electrónica is being
-- executed on behalf of, and the governing jurisdiction clause.
ALTER TABLE esig_documents
  ADD COLUMN IF NOT EXISTS governing_jurisdiction TEXT DEFAULT 'Estados Unidos Mexicanos',
  ADD COLUMN IF NOT EXISTS signing_language TEXT DEFAULT 'es-MX';

COMMENT ON COLUMN esig_signers.rfc IS 'Optional Mexican RFC of the signer for enhanced identity verification.';
COMMENT ON COLUMN esig_signers.consent_language_version IS 'Version tag of the consent text shown at signing time.';
COMMENT ON COLUMN esig_signers.consent_text IS 'Full consent language the signer accepted, preserved at signing time for audit.';

NOTIFY pgrst, 'reload schema';
