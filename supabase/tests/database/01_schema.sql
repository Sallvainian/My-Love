-- ============================================
-- pgTAP Schema Tests
-- Verify tables, columns, indexes, and types exist
-- ============================================

begin;

select plan(34);

-- ============================================
-- Tables exist
-- ============================================
select has_table('public', 'scripture_sessions', 'scripture_sessions table exists');
select has_table('public', 'scripture_step_states', 'scripture_step_states table exists');
select has_table('public', 'scripture_reflections', 'scripture_reflections table exists');
select has_table('public', 'scripture_bookmarks', 'scripture_bookmarks table exists');
select has_table('public', 'scripture_messages', 'scripture_messages table exists');

-- ============================================
-- scripture_sessions columns
-- ============================================
select has_column('public', 'scripture_sessions', 'id', 'sessions has id');
select has_column('public', 'scripture_sessions', 'mode', 'sessions has mode');
select has_column('public', 'scripture_sessions', 'user1_id', 'sessions has user1_id');
select has_column('public', 'scripture_sessions', 'user2_id', 'sessions has user2_id');
select has_column('public', 'scripture_sessions', 'current_phase', 'sessions has current_phase');
select has_column('public', 'scripture_sessions', 'current_step_index', 'sessions has current_step_index');
select has_column('public', 'scripture_sessions', 'status', 'sessions has status');
select has_column('public', 'scripture_sessions', 'version', 'sessions has version');
select has_column('public', 'scripture_sessions', 'snapshot_json', 'sessions has snapshot_json');
select has_column('public', 'scripture_sessions', 'started_at', 'sessions has started_at');
select has_column('public', 'scripture_sessions', 'completed_at', 'sessions has completed_at');

-- ============================================
-- scripture_reflections columns
-- ============================================
select has_column('public', 'scripture_reflections', 'id', 'reflections has id');
select has_column('public', 'scripture_reflections', 'session_id', 'reflections has session_id');
select has_column('public', 'scripture_reflections', 'step_index', 'reflections has step_index');
select has_column('public', 'scripture_reflections', 'user_id', 'reflections has user_id');
select has_column('public', 'scripture_reflections', 'rating', 'reflections has rating');
select has_column('public', 'scripture_reflections', 'notes', 'reflections has notes');
select has_column('public', 'scripture_reflections', 'is_shared', 'reflections has is_shared');

-- ============================================
-- scripture_bookmarks columns
-- ============================================
select has_column('public', 'scripture_bookmarks', 'id', 'bookmarks has id');
select has_column('public', 'scripture_bookmarks', 'session_id', 'bookmarks has session_id');
select has_column('public', 'scripture_bookmarks', 'step_index', 'bookmarks has step_index');
select has_column('public', 'scripture_bookmarks', 'user_id', 'bookmarks has user_id');
select has_column('public', 'scripture_bookmarks', 'share_with_partner', 'bookmarks has share_with_partner');

-- ============================================
-- Indexes exist
-- ============================================
select has_index('public', 'scripture_sessions', 'idx_scripture_sessions_user1', 'user1 index exists');
select has_index('public', 'scripture_sessions', 'idx_scripture_sessions_user2', 'user2 index exists');
select has_index('public', 'scripture_step_states', 'idx_scripture_step_states_session', 'step_states session index exists');
select has_index('public', 'scripture_reflections', 'idx_scripture_reflections_session', 'reflections session index exists');
select has_index('public', 'scripture_bookmarks', 'idx_scripture_bookmarks_session', 'bookmarks session index exists');
select has_index('public', 'scripture_messages', 'idx_scripture_messages_session', 'messages session index exists');

select * from finish();
rollback;
