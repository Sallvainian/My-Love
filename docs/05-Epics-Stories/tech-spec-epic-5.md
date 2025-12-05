# Technical Specification: Epic 5 - Mood Tracking & Transparency

**Epic ID:** 5
**Epic Title:** Mood Tracking & Transparency
**Generated:** 2025-11-25
**Status:** Draft

---

## 1. Overview and Scope

### 1.1 Epic Purpose

Epic 5 delivers the complete Mood Tracking & Transparency feature set, enabling partners to share emotional states with full visibility. This epic implements the core emotional connection pillar of My-Love by allowing users to quickly log their moods, view their partner's moods in real-time, and track mood patterns over time.

### 1.2 Business Value

**User Value Statement:** "Know how your partner is feeling throughout the day"

- **Emotional Connection:** Real-time mood visibility creates empathy and awareness between partners
- **Relationship Health:** Mood history enables pattern recognition and informed conversations
- **Convenience:** Sub-5-second logging removes friction from daily emotional check-ins

### 1.3 Scope

**In Scope:**
- 12-emotion emoji picker interface with haptic feedback
- Quick mood logging flow (< 5 seconds target)
- Partner mood viewing with full transparency
- Mood history timeline with calendar navigation
- Background sync to Supabase for partner visibility
- Offline-first local storage with eventual consistency

**Out of Scope:**
- Mood analytics/insights (future epic)
- Mood-triggered notifications to partner (future epic)
- Mood trends visualization/charts (future epic)
- Mood sharing with external parties

### 1.4 Functional Requirements Mapping

| FR ID | Requirement | Story |
|-------|-------------|-------|
| FR22 | Users can log current mood by selecting from 12 emotion options | 5.1 |
| FR23 | Users can optionally add brief text note with mood entry | 5.1, 5.2 |
| FR24 | Users can view their partner's mood entries (full transparency) | 5.3 |
| FR25 | Users can view mood history timeline showing entries over time | 5.4 |
| FR26 | Mood logging completes in under 5 seconds (quick access priority) | 5.2 |
| FR27 | System provides haptic feedback (Vibration API) on mood save confirmation | 5.2 |
| FR28 | System syncs mood entries to Supabase for partner visibility | 5.2, 5.3 |

### 1.5 Current Implementation Analysis

**Existing Components:**
- `MoodService` (src/services/moodService.ts) - IndexedDB CRUD operations ✅
- `MoodSlice` (src/stores/slices/moodSlice.ts) - Zustand state management ✅
- `MoodTracker` (src/components/MoodTracker/MoodTracker.tsx) - Logging UI ✅
- `MoodHistoryCalendar` (src/components/MoodHistory/) - History view ✅
- `moodSyncService` (src/api/moodSyncService.ts) - Supabase sync ✅

**Current Mood Types (10):**
```typescript
type MoodType = 'loved' | 'happy' | 'content' | 'thoughtful' | 'grateful'
              | 'sad' | 'anxious' | 'frustrated' | 'lonely' | 'tired';
```

**Gap Analysis:**
1. **Database Schema Gap:** Supabase `moods.mood_type` CHECK constraint only allows 5 positive moods, but frontend supports 10. Need migration.
2. **Emotion Count Gap:** PRD specifies 12 emotions, current implementation has 10. Need 2 additional moods.
3. **Partner Mood UI Gap:** Backend `fetchPartnerMoods()` exists, but no dedicated partner mood display component.
4. **Haptic Feedback Gap:** Vibration API not yet integrated for mood save confirmation.

---

## 2. Epic Overview

### 2.1 Epic Summary

**Goal:** Partners share emotional states with full transparency
**Stories:** 4 user stories implementing mood tracking, viewing, and history features

### 2.2 Story Breakdown

| Story | Title | Priority | Dependencies | Complexity |
|-------|-------|----------|--------------|------------|
| 5.1 | Mood Emoji Picker Interface | P0 | None | Medium |
| 5.2 | Quick Mood Logging Flow | P0 | 5.1 | Low |
| 5.3 | Partner Mood Viewing & Transparency | P0 | 5.2, Database Migration | Medium |
| 5.4 | Mood History Timeline | P1 | 5.1, 5.2 | Low |

### 2.3 Epic Architecture Context

```
┌─────────────────────────────────────────────────────────────────┐
│                        My-Love PWA                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │  MoodTracker    │  │ PartnerMood     │  │ MoodHistory    │  │
│  │  (Emoji Picker) │  │ Display         │  │ Calendar       │  │
│  └────────┬────────┘  └────────┬────────┘  └───────┬────────┘  │
│           │                    │                   │           │
│  ┌────────▼────────────────────▼───────────────────▼────────┐  │
│  │                     MoodSlice (Zustand)                   │  │
│  │  - moods: MoodEntry[]                                     │  │
│  │  - partnerMoods: MoodEntry[]                              │  │
│  │  - syncStatus: { pending, isOnline, lastSync }            │  │
│  └────────┬─────────────────────────────────────────┬────────┘  │
│           │                                         │           │
│  ┌────────▼────────┐                      ┌────────▼────────┐  │
│  │  MoodService    │                      │ MoodSyncService │  │
│  │  (IndexedDB)    │                      │ (Supabase)      │  │
│  └─────────────────┘                      └────────┬────────┘  │
└─────────────────────────────────────────────────────│──────────┘
                                                      │
                                            ┌─────────▼─────────┐
                                            │ Supabase Backend  │
                                            │ - moods table     │
                                            │ - RLS policies    │
                                            │ - Realtime        │
                                            └───────────────────┘
```

---

## 3. Epic Stories

{{template-output: epic_stories}}

### Story 5.1: Mood Emoji Picker Interface

**User Story:** As a user, I want to select my current mood from a visual emoji grid so that I can quickly express how I'm feeling.

**Description:**
Implement a 3x4 emoji grid displaying 12 emotion options. Each emoji is a large, easily tappable button (min 48px) with an icon and label. Support multiple mood selection with visual feedback on selected states.

**Technical Scope:**
- Expand MoodType from 10 to 12 emotions (add `excited`, `calm`)
- Update Supabase CHECK constraint via migration
- Enhance MoodTracker component with 12-emoji grid layout
- Implement multi-selection visual states (pink border, scale animation)

**New Mood Types to Add:**
```typescript
type MoodType =
  // Positive (6)
  | 'loved' | 'happy' | 'content' | 'grateful' | 'excited' | 'calm'
  // Challenging (6)
  | 'sad' | 'anxious' | 'frustrated' | 'lonely' | 'tired' | 'thoughtful';
```

**Acceptance Criteria:**
- [ ] AC-5.1.1: 12 emotion emojis displayed in 3x4 grid layout
- [ ] AC-5.1.2: Each emoji has icon, label, and minimum 48px touch target
- [ ] AC-5.1.3: Selected mood(s) show pink border and scale animation
- [ ] AC-5.1.4: Multiple moods can be selected (multi-select mode)
- [ ] AC-5.1.5: Positive moods grouped separately from challenging moods
- [ ] AC-5.1.6: Selected moods display summary below grid

**Technical Tasks:**
1. Update `MoodType` in `src/types/index.ts` to add `excited`, `calm`
2. Create Supabase migration `004_expand_mood_types.sql` to update CHECK constraint
3. Update `POSITIVE_MOODS` and `NEGATIVE_MOODS` in MoodTracker.tsx
4. Add new icons for `excited` (Star), `calm` (Moon) to mood config
5. Verify IndexedDB MoodEntrySchema accepts new mood types

---

### Story 5.2: Quick Mood Logging Flow

**User Story:** As a user, I want to log my mood in under 5 seconds so that tracking doesn't interrupt my day.

**Description:**
Optimize the mood logging flow for speed. Single tap on emoji → optional note → save. Implement haptic feedback on save confirmation using Vibration API.

**Technical Scope:**
- Performance optimization for < 5 second flow
- Vibration API integration for haptic feedback
- Auto-save option (single tap without confirmation)
- Success toast animation

**Acceptance Criteria:**
- [ ] AC-5.2.1: Mood logging completes in < 5 seconds from screen load
- [ ] AC-5.2.2: Device vibrates on successful mood save (50ms pulse)
- [ ] AC-5.2.3: Success toast appears for 3 seconds after save
- [ ] AC-5.2.4: Optional note field doesn't block save (can save with just mood)
- [ ] AC-5.2.5: Mood syncs to Supabase in background (doesn't block UI)
- [ ] AC-5.2.6: Offline indicator shows when device is offline

**Technical Tasks:**
1. Add Vibration API call in MoodTracker handleSubmit success path
2. Verify existing success toast animation (already implemented)
3. Add performance timing measurement to validate < 5s flow
4. Ensure background sync doesn't block UI (already implemented)
5. Add E2E test measuring mood logging time

---

### Story 5.3: Partner Mood Viewing & Transparency

**User Story:** As a user, I want to see my partner's current mood so that I know how they're feeling.

**Description:**
Display partner's most recent mood prominently on the Mood screen. Show mood emoji, label, and time since logged. Implement Supabase Realtime subscription for live updates.

**Technical Scope:**
- New `PartnerMoodDisplay` component
- Supabase Realtime subscription for partner mood changes
- Integration with MoodSlice `partnerMoods` state
- Display partner mood at top of MoodTracker screen

**Acceptance Criteria:**
- [ ] AC-5.3.1: Partner's current mood displayed at top of Mood screen
- [ ] AC-5.3.2: Shows partner's mood emoji, label, and relative time ("2 hours ago")
- [ ] AC-5.3.3: Partner mood updates in real-time via Supabase Realtime
- [ ] AC-5.3.4: Graceful fallback when partner hasn't logged mood ("No mood yet today")
- [ ] AC-5.3.5: Partner mood section has distinct visual styling (soft card, partner name)
- [ ] AC-5.3.6: Tapping partner mood opens their mood history view

**Technical Tasks:**
1. Create `PartnerMoodDisplay` component in `src/components/MoodTracker/`
2. Add Supabase Realtime subscription in MoodSlice for partner mood changes
3. Integrate `PartnerMoodDisplay` at top of MoodTracker screen
4. Add relative time display using date-fns `formatDistanceToNow`
5. Style with Tailwind: bg-pink-50 card with soft border

---

### Story 5.4: Mood History Timeline

**User Story:** As a user, I want to view my mood history on a calendar so that I can see patterns over time.

**Description:**
Calendar-based mood history view showing daily mood entries. Tap date to see detailed mood with note. Support navigation between months.

**Technical Scope:**
- Enhance existing `MoodHistoryCalendar` component
- Color-coded calendar cells based on mood
- Date detail modal showing full mood entry
- Month navigation arrows

**Acceptance Criteria:**
- [ ] AC-5.4.1: Calendar displays current month with mood indicators per day
- [ ] AC-5.4.2: Days with moods show colored dot/emoji based on primary mood
- [ ] AC-5.4.3: Tapping day opens modal with full mood details (mood, note, time)
- [ ] AC-5.4.4: Month navigation (< >) allows viewing previous months
- [ ] AC-5.4.5: Current day highlighted distinctly
- [ ] AC-5.4.6: Days with partner mood show separate indicator

**Technical Tasks:**
1. Review existing MoodHistoryCalendar implementation
2. Add mood color mapping (happy=green, sad=blue, etc.)
3. Implement date detail modal component
4. Add month navigation state and controls
5. Integrate partner mood indicators on calendar cells

---

## 4. Detailed Design

{{template-output: detailed_design}}

### 4.1 Data Models

#### 4.1.1 MoodEntry (TypeScript)

```typescript
// src/types/index.ts
export type MoodType =
  // Positive emotions (6)
  | 'loved'      // ❤️ Heart
  | 'happy'      // 😊 Smile
  | 'content'    // 😌 Relieved face
  | 'grateful'   // ✨ Sparkles
  | 'excited'    // ⭐ Star (NEW)
  | 'calm'       // 🌙 Moon (NEW)
  // Challenging emotions (6)
  | 'sad'        // 😢 Frown
  | 'anxious'    // 😰 Alert
  | 'frustrated' // 😤 Angry
  | 'lonely'     // 👤 User minus
  | 'tired'      // 🔋 Battery
  | 'thoughtful' // 💭 Message circle

export interface MoodEntry {
  id?: number;                    // IndexedDB auto-increment
  userId: string;                 // Supabase auth user ID
  mood: MoodType;                 // Primary mood (backward compat)
  moods?: MoodType[];             // All selected moods
  note?: string;                  // Optional note (max 200 chars)
  date: string;                   // YYYY-MM-DD format
  timestamp: Date;                // Full ISO timestamp
  synced: boolean;                // Supabase sync status
  supabaseId?: string;            // Remote record ID
}
```

#### 4.1.2 Database Schema Migration

```sql
-- Migration: 004_expand_mood_types.sql
-- Purpose: Expand mood_type CHECK constraint to support all 12 emotions

-- Step 1: Drop existing constraint
ALTER TABLE moods DROP CONSTRAINT IF EXISTS moods_mood_type_check;

-- Step 2: Add expanded constraint
ALTER TABLE moods ADD CONSTRAINT moods_mood_type_check
CHECK (mood_type IN (
  'loved', 'happy', 'content', 'grateful', 'excited', 'calm',
  'sad', 'anxious', 'frustrated', 'lonely', 'tired', 'thoughtful'
));

-- Step 3: Add index for partner mood queries
CREATE INDEX IF NOT EXISTS idx_moods_created_desc ON moods(created_at DESC);
```

### 4.2 Component Architecture

#### 4.2.1 New Components

```
src/components/
├── MoodTracker/
│   ├── MoodTracker.tsx          # Main mood logging screen (existing)
│   ├── MoodButton.tsx           # Individual emoji button (existing)
│   ├── MoodEmojiGrid.tsx        # 3x4 emoji grid layout (NEW)
│   └── PartnerMoodDisplay.tsx   # Partner's current mood card (NEW)
├── MoodHistory/
│   ├── MoodHistoryCalendar.tsx  # Calendar view (existing)
│   ├── MoodDayDetail.tsx        # Day detail modal (NEW)
│   └── index.ts                 # Exports
```

#### 4.2.2 PartnerMoodDisplay Component

```typescript
// src/components/MoodTracker/PartnerMoodDisplay.tsx
interface PartnerMoodDisplayProps {
  partnerName: string;
  mood: MoodEntry | undefined;
  onTap?: () => void;
}

export function PartnerMoodDisplay({ partnerName, mood, onTap }: PartnerMoodDisplayProps) {
  if (!mood) {
    return (
      <div className="bg-pink-50 rounded-xl p-4 mb-6 border border-pink-100">
        <p className="text-gray-500 text-center">
          {partnerName} hasn't logged a mood today
        </p>
      </div>
    );
  }

  return (
    <button onClick={onTap} className="w-full bg-pink-50 rounded-xl p-4 mb-6 border border-pink-100 text-left">
      <div className="flex items-center gap-3">
        <MoodIcon mood={mood.mood} size={40} />
        <div>
          <p className="font-medium text-gray-900">{partnerName} is feeling {mood.mood}</p>
          <p className="text-sm text-gray-500">{formatDistanceToNow(mood.timestamp)} ago</p>
        </div>
      </div>
    </button>
  );
}
```

### 4.3 API Contracts

#### 4.3.1 Supabase Realtime Subscription

```typescript
// src/stores/slices/moodSlice.ts - Addition for real-time partner moods
const subscribeToPartnerMoods = (partnerId: string) => {
  const channel = supabase
    .channel('partner-moods')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'moods',
        filter: `user_id=eq.${partnerId}`,
      },
      (payload) => {
        // Update partnerMoods state with new entry
        set((state) => ({
          partnerMoods: [transformMood(payload.new), ...state.partnerMoods],
        }));
      }
    )
    .subscribe();

  return () => channel.unsubscribe();
};
```

### 4.4 Haptic Feedback Implementation

```typescript
// src/utils/haptics.ts
export function triggerMoodSaveHaptic() {
  if ('vibrate' in navigator) {
    navigator.vibrate(50); // 50ms pulse
  }
}

// Usage in MoodTracker.tsx handleSubmit:
await addMoodEntry(selectedMoods, note);
triggerMoodSaveHaptic(); // After successful save
setShowSuccess(true);
```

---

## 5. Non-Functional Requirements

{{template-output: nfr}}

### 5.1 Performance Requirements

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| Mood logging time | < 5 seconds | From screen load to save confirmation |
| Supabase sync latency | < 2 seconds | Background, non-blocking |
| Partner mood update | < 1 second | Via Realtime subscription |
| Calendar render | < 500ms | For 30-day view |

### 5.2 Accessibility Requirements

| Requirement | Implementation |
|-------------|----------------|
| Touch targets | Minimum 48x48px for all emoji buttons |
| Screen reader | `aria-label` on all mood buttons with emotion name |
| Focus management | Visible focus rings, keyboard navigation support |
| Color contrast | WCAG AA (4.5:1) for all text elements |

### 5.3 Offline Behavior

| State | Behavior |
|-------|----------|
| Offline mood save | Save to IndexedDB, queue for background sync |
| Partner mood unavailable | Show cached last-known mood with "Last seen X ago" |
| Reconnection | Auto-sync pending moods, refresh partner mood |

### 5.4 Security Requirements

- RLS policies ensure users only modify own moods
- Partner mood visibility controlled by environment config
- No PII exposed in mood entries (userId is UUID)

---

## 6. Dependencies and Integrations

{{template-output: dependencies}}

### 6.1 Internal Dependencies

| Dependency | Type | Required By |
|------------|------|-------------|
| Epic 1: Authentication Foundation | Hard | All stories (user context) |
| MoodService (IndexedDB) | Hard | Story 5.1, 5.2, 5.4 |
| MoodSyncService (Supabase) | Hard | Story 5.2, 5.3 |
| useAppStore (Zustand) | Hard | All stories |

### 6.2 External Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| date-fns | ^3.x | Relative time formatting |
| lucide-react | ^0.300.x | Mood icons |
| framer-motion | ^10.x | Animations |
| @supabase/supabase-js | ^2.x | Backend sync, Realtime |

### 6.3 Database Dependencies

| Table | Access | Description |
|-------|--------|-------------|
| moods | CRUD | Mood entries with expanded mood_type |
| users | Read | Partner lookup via partner_id |

### 6.4 Migration Dependencies

**Required Migration:** `004_expand_mood_types.sql`
- Must run before deploying Story 5.1
- Updates CHECK constraint to support 12 mood types
- Non-breaking (additive change only)

---

## 7. Acceptance Criteria and Traceability

{{template-output: acceptance_criteria}}

### 7.1 Story-to-FR Traceability Matrix

| Story | FR22 | FR23 | FR24 | FR25 | FR26 | FR27 | FR28 |
|-------|------|------|------|------|------|------|------|
| 5.1   | ✅   | ✅   |      |      |      |      |      |
| 5.2   |      | ✅   |      |      | ✅   | ✅   | ✅   |
| 5.3   |      |      | ✅   |      |      |      | ✅   |
| 5.4   |      |      |      | ✅   |      |      |      |

### 7.2 Definition of Done

**Story Level:**
- [ ] All acceptance criteria met
- [ ] Unit tests pass (≥80% coverage)
- [ ] E2E test for critical path
- [ ] No TypeScript errors
- [ ] Accessibility audit passed
- [ ] Code reviewed and approved

**Epic Level:**
- [ ] All 4 stories complete
- [ ] Database migration applied to production
- [ ] Supabase Realtime enabled for moods table
- [ ] < 5 second mood logging verified via E2E test
- [ ] Partner mood transparency working end-to-end

---

## 8. Risks and Mitigation

{{template-output: risks}}

### 8.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Database migration breaks existing moods | Low | High | Migration is additive only, existing values remain valid |
| Realtime subscription performance | Medium | Medium | Debounce updates, lazy subscribe only when on mood screen |
| Vibration API not supported | Low | Low | Graceful degradation (no vibration on unsupported browsers) |
| Partner ID not configured | Medium | Medium | Clear error message, fallback to "no partner" state |

### 8.2 Dependency Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Epic 1 auth not complete | Low | High | Epic 5 blocked until Epic 1 auth stories done |
| Supabase Realtime quota | Low | Medium | Monitor usage, batch subscription updates |

### 8.3 UX Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| 12 emotions overwhelming | Medium | Low | Group positive/negative, use familiar emoji icons |
| 5-second target too aggressive | Low | Medium | Already achieved in existing implementation |

---

## 9. Test Strategy

{{template-output: test_strategy}}

### 9.1 Unit Tests

**Focus Areas:**
- MoodType validation (all 12 types)
- MoodEntry schema validation
- Haptic utility function
- Date formatting utilities

**Test Files:**
- `src/types/__tests__/MoodType.test.ts`
- `src/utils/__tests__/haptics.test.ts`
- `src/components/MoodTracker/__tests__/PartnerMoodDisplay.test.tsx`

### 9.2 Integration Tests

**Focus Areas:**
- MoodSlice addMoodEntry with new mood types
- MoodService IndexedDB operations with 12 moods
- MoodSyncService Supabase upsert with expanded types

### 9.3 E2E Tests

**Critical User Journeys:**

```typescript
// tests/e2e/mood-tracking.spec.ts

test('User can log mood in under 5 seconds', async ({ page }) => {
  const startTime = Date.now();

  await page.goto('/moods');
  await page.getByTestId('mood-button-happy').click();
  await page.getByTestId('mood-submit-button').click();
  await expect(page.getByTestId('mood-success-toast')).toBeVisible();

  const elapsed = Date.now() - startTime;
  expect(elapsed).toBeLessThan(5000);
});

test('User can view partner mood', async ({ page }) => {
  await page.goto('/moods');
  await expect(page.getByTestId('partner-mood-display')).toBeVisible();
  await expect(page.getByText(/feeling/i)).toBeVisible();
});

test('User can navigate mood history calendar', async ({ page }) => {
  await page.goto('/moods');
  await page.getByTestId('mood-tab-history').click();
  await expect(page.getByTestId('mood-history-calendar')).toBeVisible();
  await page.getByTestId('calendar-prev-month').click();
  // Verify month changed
});
```

### 9.4 Accessibility Tests

- axe-core automated scan on MoodTracker screen
- Manual VoiceOver testing for emoji selection
- Keyboard navigation verification

---

## 10. Appendix

### 10.1 Mood Icon Mapping

| Mood | Icon (Lucide) | Color (Tailwind) | Category |
|------|---------------|------------------|----------|
| loved | Heart | text-pink-500 | Positive |
| happy | Smile | text-yellow-500 | Positive |
| content | SmilePlus | text-green-500 | Positive |
| grateful | Sparkles | text-purple-500 | Positive |
| excited | Star | text-orange-500 | Positive |
| calm | Moon | text-blue-400 | Positive |
| sad | Frown | text-blue-600 | Challenging |
| anxious | AlertCircle | text-red-400 | Challenging |
| frustrated | Angry | text-red-600 | Challenging |
| lonely | UserMinus | text-gray-500 | Challenging |
| tired | Battery | text-gray-600 | Challenging |
| thoughtful | MessageCircle | text-indigo-500 | Challenging |

### 10.2 Related Documentation

- [PRD](../01-PRD/prd.md) - FR22-FR28
- [Architecture](../02-Architecture/architecture.md) - State management, Supabase integration
- [UX Spec](../09-UX-Spec/ux-design-specification.md) - Journey 2: Quick Mood Log
- [Epic Overview](./epics.md) - Epic 5 breakdown

---

*Generated by BMAD Method - Epic Tech Context Workflow*
*Last Updated: 2025-11-25*
