-- ============================================
-- Migration: Enable pgTAP extension
-- Created: 2026-02-06
-- Purpose: Enable pgTAP for database-level testing via `supabase test db`
-- ============================================

create extension if not exists pgtap schema extensions;
