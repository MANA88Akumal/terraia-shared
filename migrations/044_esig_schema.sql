-- 044: TerraIA eSig — blockchain-certified electronic signatures
-- Phase 2 of the eSig build plan.
--
-- Tables:
--   esig_documents      one row per signing request (PDF + metadata + on-chain refs)
--   esig_signers        one row per signer; sign_token is the public magic-link auth
--   esig_audit_log      append-only event log for legal paper trail
--
-- Storage buckets (create manually in Supabase dashboard):
--   esig-documents     private  — original + signed PDFs
--   esig-signatures    private  — drawn signature PNGs
--   esig-certificates  public   — 1-page PDF certificate for each completed doc

-- ─── esig_documents ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS esig_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'purchase_agreement', 'loan_agreement', 'broker_commission',
    'corporate_resolution', 'lp_agreement', 'other'
  )),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'pending', 'completed', 'expired', 'cancelled'
  )),
  original_pdf_path TEXT NOT NULL,
  signed_pdf_path TEXT,
  certificate_pdf_path TEXT,
  doc_hash_sha256 TEXT,
  signed_doc_hash TEXT,

  -- Polygon on-chain certification
  polygon_tx_hash TEXT,
  polygon_block_number BIGINT,
  polygon_certified_at TIMESTAMPTZ,
  ipfs_cid TEXT,

  signers_required_sequential BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_esig_docs_tenant ON esig_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_esig_docs_status ON esig_documents(status);
CREATE INDEX IF NOT EXISTS idx_esig_docs_type ON esig_documents(document_type);

-- ─── esig_signers ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS esig_signers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES esig_documents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN (
    'buyer', 'seller', 'investor', 'broker', 'legal_rep', 'witness', 'developer', 'other'
  )),
  signing_order INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'sent', 'viewed', 'signed', 'declined'
  )),
  sign_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  otp_secret TEXT,
  otp_verified BOOLEAN NOT NULL DEFAULT false,
  signed_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  declined_reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  signature_image_path TEXT,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_esig_signers_document ON esig_signers(document_id);
CREATE INDEX IF NOT EXISTS idx_esig_signers_token ON esig_signers(sign_token);
CREATE INDEX IF NOT EXISTS idx_esig_signers_email ON esig_signers(email);

-- ─── esig_audit_log ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS esig_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES esig_documents(id) ON DELETE CASCADE,
  signer_id UUID REFERENCES esig_signers(id) ON DELETE SET NULL,
  event TEXT NOT NULL,                                -- 'created', 'sent', 'viewed', 'otp_sent', 'otp_verified', 'signed', 'declined', 'completed', 'certified_on_chain', 'cancelled'
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_esig_audit_document ON esig_audit_log(document_id);
CREATE INDEX IF NOT EXISTS idx_esig_audit_event ON esig_audit_log(event);
CREATE INDEX IF NOT EXISTS idx_esig_audit_created ON esig_audit_log(created_at DESC);

-- ─── RLS ────────────────────────────────────────────────────────────────
ALTER TABLE esig_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE esig_signers ENABLE ROW LEVEL SECURITY;
ALTER TABLE esig_audit_log ENABLE ROW LEVEL SECURITY;

-- esig_documents: tenant members read/write within their tenant; platform admins see all
CREATE POLICY esig_docs_tenant_read ON esig_documents FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM user_roles
    WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY esig_docs_platform_admin ON esig_documents FOR ALL
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY esig_docs_tenant_write ON esig_documents FOR ALL
  USING (tenant_id IN (
    SELECT tenant_id FROM user_roles
    WHERE user_id = auth.uid() AND is_active = true
      AND role IN ('admin', 'tenant_admin', 'staff', 'legal', 'sales_mgr', 'finance')
  ))
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM user_roles
    WHERE user_id = auth.uid() AND is_active = true
      AND role IN ('admin', 'tenant_admin', 'staff', 'legal', 'sales_mgr', 'finance')
  ));

-- esig_signers: readable by anyone inside tenant OR anyone with the sign_token.
-- The sign_token check is done at the API layer (public endpoint reads via
-- service role), so here we only grant tenant-member access.
CREATE POLICY esig_signers_tenant_read ON esig_signers FOR SELECT
  USING (document_id IN (
    SELECT id FROM esig_documents d
    WHERE d.tenant_id IN (
      SELECT tenant_id FROM user_roles
      WHERE user_id = auth.uid() AND is_active = true
    )
  ));

CREATE POLICY esig_signers_platform_admin ON esig_signers FOR ALL
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- Audit log — read-only for tenant members, platform admins see all.
-- Inserts happen via service role (API routes) so no INSERT policy needed
-- beyond the platform admin one.
CREATE POLICY esig_audit_tenant_read ON esig_audit_log FOR SELECT
  USING (document_id IN (
    SELECT id FROM esig_documents d
    WHERE d.tenant_id IN (
      SELECT tenant_id FROM user_roles
      WHERE user_id = auth.uid() AND is_active = true
    )
  ));

CREATE POLICY esig_audit_platform_admin ON esig_audit_log FOR ALL
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

NOTIFY pgrst, 'reload schema';
