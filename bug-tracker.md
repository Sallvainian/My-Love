# Bug Tracker - 2025-11-15

## 🔴 Critical Issues

### 1. Failed to Initialize App / Stale Cache Issue
**Status**: 🔴 Critical
**Priority**: Highest
**Description**: Application fails to initialize, requiring manual cache clear on each visit
**Impact**: User experience severely degraded, blocks normal app usage
**Next Steps**:
- Investigate service worker and cache control headers
- Implement proper cache invalidation strategy
- Add version-based cache busting

### 2. UUID Validation Error - "default-user"
**Status**: 🔴 Critical
**Priority**: Highest
**Error**: `invalid input syntax for type uuid: "default-user"`
**Location**: `moodApi.ts:118`, `errorHandlers.ts:75`
**Description**: MoodSyncService attempting to sync moods with invalid user ID "default-user" instead of real UUID
**Impact**: All mood sync operations failing (4 retry attempts exhausted)
**Frequency**: Continuous failures, 1 pending mood unable to sync
**Next Steps**:
- Check authentication flow and user ID storage
- Ensure proper user ID is set after OAuth login
- Fix default user ID fallback logic

### 3. Partner ID Lookup Failures
**Status**: 🟡 Important
**Priority**: High
**Error**: `Cannot coerce the result to a single JSON object` (PGRST116)
**Description**: Partner relationship queries returning 0 rows
**Impact**: Partner mood view non-functional
**Frequency**: Every partner view access
**Next Steps**:
- Verify partner relationship data exists in database
- Check RLS policies for partner queries
- Validate partner linking logic

## 🟢 Minor Issues

### 4. Cookie Rejection Warning
**Status**: 🟢 Low Priority
**Error**: `Cookie "__cf_bm" has been rejected for invalid domain`
**Description**: Cloudflare bot management cookie domain mismatch
**Impact**: Minimal - websocket functionality appears unaffected
**Next Steps**: Review if this affects any functionality, may be ignorable

### 5. Source Map Error
**Status**: 🟢 Low Priority
**Error**: JSON.parse error in source map loader
**Resource**: `installHook.js.map`
**Impact**: Development only - doesn't affect functionality
**Next Steps**: Low priority, check if source maps are properly generated

## ✅ Working Features

- Google OAuth login: ✅ Functional
- UI rendering: ✅ Mostly working
- Local mood storage: ✅ Working (1 mood stored locally)
- Navigation: ✅ Working (home/partner view switching)

## Error Pattern Analysis

**Root Cause Chain**:
1. User logs in via OAuth ✅
2. User ID not properly set → defaults to "default-user" ❌
3. Mood created with invalid user_id ❌
4. Sync attempts fail with UUID validation error ❌
5. Retries exhausted (4 attempts) ❌
6. Mood remains unsynced indefinitely ❌

**Cascading Effects**:
- Partner queries fail because user relationship data relies on valid UUIDs
- Cache issues may be related to authentication state persistence

## ✅ FIXED (2025-11-15)

### 1. UUID Validation Error - "default-user" ✅
**Status**: Fixed
**Changes**:
- Removed hardcoded `USER_ID = 'default-user'` constant from `src/config/constants.ts`
- Updated `moodService.create()` to require `userId: string` parameter
- Updated `moodSlice.addMoodEntry()` to get real user ID from `authService.getCurrentUserId()`
- Updated all unit tests (31 tests passing)
**Impact**: Mood sync now uses real Supabase UUID instead of "default-user"

### 2. Service Worker Cache Issues ✅
**Status**: Fixed
**Changes**:
- Changed JS/CSS caching strategy from default to `NetworkFirst` with 5-minute expiration
- Added `cleanupOutdatedCaches: true` to remove stale caches automatically
- Implemented auto-reload on service worker update via `onNeedRefresh()` callback
- Separated caching strategies: Network-first for app code, Cache-first for static assets
**Impact**: Browser will check for fresh code first, auto-reload when updates available

## Next Session Priorities

1. **Test fixes in dev server** - Verify UUID fix and cache invalidation work
2. **Fix partner ID lookup errors** (dependent on UUID fix working)
3. **Verify all mood sync operations** - Ensure moods sync to Supabase correctly
