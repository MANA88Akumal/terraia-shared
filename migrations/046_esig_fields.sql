-- 046: Per-signer placed fields on a document.
-- Each row is a single placed widget (signature box, initial box, date,
-- text, checkbox). Coordinates are stored as fractions of the page
-- (0..1 from top-left) so they are resolution and renderer agnostic —
-- the same values work for pdfjs in the browser and pdf-lib on the
-- server when we overlay-stamp the signed PDF.

CREATE TABLE IF NOT EXISTS esig_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES esig_documents(id) ON DELETE CASCADE,
  signer_id UUID NOT NULL REFERENCES esig_signers(id) ON DELETE CASCADE,
  field_type TEXT NOT NULL CHECK (field_type IN ('signature','initial','date','text','checkbox')),
  page_index INTEGER NOT NULL CHECK (page_index >= 0),
  x NUMERIC(6,5) NOT NULL CHECK (x >= 0 AND x <= 1),
  y NUMERIC(6,5) NOT NULL CHECK (y >= 0 AND y <= 1),
  width NUMERIC(6,5) NOT NULL CHECK (width > 0 AND width <= 1),
  height NUMERIC(6,5) NOT NULL CHECK (height > 0 AND height <= 1),
  required BOOLEAN NOT NULL DEFAULT true,
  label TEXT,
  -- value holds the filled value: text/date as-is, checkbox 'true'/'false',
  -- signature/initial = storage path of the rendered image.
  value TEXT,
  filled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_esig_fields_document ON esig_fields(document_id);
CREATE INDEX IF NOT EXISTS idx_esig_fields_signer ON esig_fields(signer_id);

ALTER TABLE esig_fields ENABLE ROW LEVEL SECURITY;

-- Tenant members can read all fields on documents in their tenant.
DROP POLICY IF EXISTS esig_fields_select ON esig_fields;
CREATE POLICY esig_fields_select ON esig_fields FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM esig_documents d
      WHERE d.id = esig_fields.document_id
        AND (
          public.is_platform_admin()
          OR d.tenant_id IN (SELECT public.caller_admin_tenant_ids())
          OR public.user_is_in_tenants(auth.uid(), ARRAY[d.tenant_id])
        )
    )
  );

-- Tenant members can write fields on documents in their tenant AS LONG
-- AS the document is still a draft. After 'pending'/'completed' fields
-- are immutable (signer fills happen server-side with the service key).
DROP POLICY IF EXISTS esig_fields_write ON esig_fields;
CREATE POLICY esig_fields_write ON esig_fields FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM esig_documents d
      WHERE d.id = esig_fields.document_id
        AND d.status = 'draft'
        AND (
          public.is_platform_admin()
          OR d.tenant_id IN (SELECT public.caller_admin_tenant_ids())
          OR public.user_is_in_tenants(auth.uid(), ARRAY[d.tenant_id])
        )
    )
  );

COMMENT ON TABLE esig_fields IS 'Placed signature/initial/date/text/checkbox widgets, per signer.';
COMMENT ON COLUMN esig_fields.x IS 'Fractional X (0..1) from top-left of the page.';
COMMENT ON COLUMN esig_fields.y IS 'Fractional Y (0..1) from top-left of the page.';
COMMENT ON COLUMN esig_fields.value IS 'Filled value: text/date raw, checkbox true/false, signature/initial = storage path.';

NOTIFY pgrst, 'reload schema';
