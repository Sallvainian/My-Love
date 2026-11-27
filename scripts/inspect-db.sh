#!/bin/bash
# Supabase Database Inspector
# Queries remote Supabase database to show current schema

echo "=== Supabase Database Inspector ==="
echo "Project: xojempkrugifnaveqtqc"
echo ""

# Show tables with details
echo "📋 Tables in public schema:"
supabase db query --remote --read-only \
    "SELECT
        tablename,
        pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS size
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename;"

echo ""
echo "📊 Row counts per table:"
supabase db query --remote --read-only \
    "SELECT
        'users' AS table_name, COUNT(*) AS row_count FROM users
    UNION ALL SELECT 'moods', COUNT(*) FROM moods
    UNION ALL SELECT 'interactions', COUNT(*) FROM interactions
    UNION ALL SELECT 'partner_requests', COUNT(*) FROM partner_requests
    ORDER BY table_name;"

echo ""
echo "🔐 RLS Policies:"
supabase db query --remote --read-only \
    "SELECT tablename, policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;"

echo ""
echo "📐 Table columns:"
supabase db query --remote --read-only \
    "SELECT
        table_name,
        column_name,
        data_type,
        is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position;"
