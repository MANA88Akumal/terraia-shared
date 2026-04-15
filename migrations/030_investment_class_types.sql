-- ============================================================================
-- Migration 030: Update investment_class to Preferred Equity / Convertible
-- ============================================================================
-- Replaces B-1/B-2/B-3/C class labels with the two actual investment types:
-- - preferred_equity: receives distributions through lockbox waterfall
-- - convertible: converts investment + returns into villa construction

-- Update existing records
UPDATE platform_investor_profiles
SET investment_class = 'preferred_equity'
WHERE investment_class IN ('B-1', 'B-2', 'B-3');

UPDATE platform_investor_profiles
SET investment_class = 'convertible'
WHERE investment_class = 'C';

NOTIFY pgrst, 'reload schema';
