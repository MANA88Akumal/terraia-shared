-- ============================================================================
-- Migration 031: Add cc_zold58 flag to clients
-- ============================================================================
-- When true, all case-related emails for this client also CC ana@zold58.com

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS cc_zold58 BOOLEAN DEFAULT false;

NOTIFY pgrst, 'reload schema';
