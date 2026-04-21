-- 037: Notification preferences on profiles
-- TerraIA Platform — Client Portal
--
-- Persists the email and WhatsApp notification toggles that live on the
-- /profile page. Both default true so existing users keep getting updates
-- without any migration data step.
-- No RLS change needed.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email_updates BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_alerts BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN profiles.email_updates IS
  'User-controlled preference — send newsletters, announcements, and project updates by email.';
COMMENT ON COLUMN profiles.whatsapp_alerts IS
  'User-controlled preference — send urgent payment and construction alerts via WhatsApp.';

NOTIFY pgrst, 'reload schema';
