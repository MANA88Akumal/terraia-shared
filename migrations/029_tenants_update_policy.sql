-- ============================================================================
-- Migration 029: Allow admins to update tenants (for brand settings)
-- ============================================================================

-- Allow admins to update their own tenant row
CREATE POLICY tenant_update ON tenants
  FOR UPDATE USING (
    id IN (
      SELECT ur.tenant_id FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.is_active = true
        AND ur.role IN ('admin', 'platform_admin', 'tenant_admin')
    )
  );

NOTIFY pgrst, 'reload schema';
