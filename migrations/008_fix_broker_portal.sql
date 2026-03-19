-- Migration 008: Fix Broker Portal Schema
-- The brokers table (from CMS migration 002) lacks org_id and user_id columns
-- that the broker-portal app expects. The broker_leads table has schema mismatches
-- with the code (single client_name vs split first/last, lot_interest type).
--
-- Run this in the Supabase SQL Editor.

-- =============================================
-- PART 1: Fix brokers table — add org_id and user_id
-- =============================================

-- The broker portal queries: .eq('org_id', orgId).eq('user_id', user.id)
-- But the original table only has profile_id and tenant_id (from migration 006)
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS user_id UUID;

-- Backfill org_id from tenant_id for existing rows
UPDATE brokers SET org_id = tenant_id WHERE org_id IS NULL AND tenant_id IS NOT NULL;

-- Unique index so we can upsert by (org_id, user_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_brokers_org_user
  ON brokers(org_id, user_id) WHERE user_id IS NOT NULL;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_brokers_org ON brokers(org_id);

-- =============================================
-- PART 2: Fix broker_leads table — split name fields
-- =============================================

-- Code uses client_first_name + client_last_name but schema has client_name (single)
ALTER TABLE broker_leads ADD COLUMN IF NOT EXISTS client_first_name TEXT;
ALTER TABLE broker_leads ADD COLUMN IF NOT EXISTS client_last_name TEXT;
ALTER TABLE broker_leads ADD COLUMN IF NOT EXISTS client_nationality TEXT;

-- Backfill: copy client_name → client_first_name for existing rows
UPDATE broker_leads
SET client_first_name = client_name
WHERE client_first_name IS NULL AND client_name IS NOT NULL;

-- Fix lot_interest type: migration 007 defined it as INTEGER, but code passes UUID (lot.id)
-- We need to drop and recreate since INTEGER → UUID isn't a simple cast
ALTER TABLE broker_leads DROP COLUMN IF EXISTS lot_interest;
ALTER TABLE broker_leads ADD COLUMN IF NOT EXISTS lot_interest UUID;

-- =============================================
-- PART 3: Update RLS policies for new columns
-- =============================================

-- Drop existing open policies if they exist and recreate with org_id scoping
DO $$
BEGIN
  -- brokers policies
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'brokers' AND policyname = 'brokers_org_select') THEN
    DROP POLICY brokers_org_select ON brokers;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'brokers' AND policyname = 'brokers_org_insert') THEN
    DROP POLICY brokers_org_insert ON brokers;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'brokers' AND policyname = 'brokers_org_update') THEN
    DROP POLICY brokers_org_update ON brokers;
  END IF;
END $$;

-- Allow authenticated users to read/write brokers in their org
CREATE POLICY brokers_org_select ON brokers FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));
CREATE POLICY brokers_org_insert ON brokers FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));
CREATE POLICY brokers_org_update ON brokers FOR UPDATE TO authenticated
  USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

-- Service role bypass (for onboarding seeder)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'brokers' AND policyname = 'brokers_service_role') THEN
    CREATE POLICY brokers_service_role ON brokers FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
