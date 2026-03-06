-- Migration 010: Benchmark Quality Scoring (Phase 4 Learning System)
-- Adds quality_score column and RPC for incrementing scores on corroboration

-- 1. Add quality_score column to benchmark_store
ALTER TABLE benchmark_store ADD COLUMN IF NOT EXISTS quality_score INT DEFAULT 1;

-- 2. Update existing seed rows to quality 5 (manually curated = higher baseline)
UPDATE benchmark_store SET quality_score = 5 WHERE quality_score IS NULL OR quality_score = 1;

-- 3. Create RPC to increment quality scores (called when similar data corroborates)
CREATE OR REPLACE FUNCTION increment_quality_scores(record_ids UUID[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE benchmark_store
  SET quality_score = LEAST(quality_score + 1, 10)
  WHERE id = ANY(record_ids);
END;
$$;

-- 4. Grant execute to authenticated (called from contribute.js)
GRANT EXECUTE ON FUNCTION increment_quality_scores(UUID[]) TO authenticated;

-- 5. Ensure SELECT on benchmark_store is available (for BenchmarkChart distribution queries)
GRANT SELECT ON benchmark_store TO anon, authenticated;
GRANT INSERT ON benchmark_store TO authenticated;
