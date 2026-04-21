-- 036: Hero image on lots
-- TerraIA Platform — Client Portal
--
-- Adds an optional hero image URL per lot so the client-portal MyProperty
-- page can show the actual property instead of a hardcoded community photo.
-- Nullable; UI falls back to the default community image when absent.
-- No RLS change needed.

ALTER TABLE lots
  ADD COLUMN IF NOT EXISTS hero_image_url TEXT;

COMMENT ON COLUMN lots.hero_image_url IS
  'Optional hero image for the client-portal MyProperty page. Full URL or storage path. Null falls back to the default community hero.';

NOTIFY pgrst, 'reload schema';
