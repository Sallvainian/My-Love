# Story 5.1: Mood Emoji Picker Interface

**Epic**: 5 - Mood Tracking & Transparency
**Story ID**: 5.1
**Status**: drafted
**Created**: 2025-11-25

---

## User Story

**As a** user,
**I want** to select my current mood from a visual emoji grid,
**So that** I can quickly express how I'm feeling to my partner.

---

## Context

This is the first story of Epic 5, establishing the enhanced mood emoji picker interface. The existing MoodTracker component supports 10 moods, but the PRD specifies 12 emotions. This story expands the mood types and improves the visual grid layout for better usability.

**Epic Goal**: Partners share emotional states with full transparency
**User Value**: Quick, intuitive mood selection with visual feedback enabling sub-5-second mood logging

**Dependencies**:
- Epic 1 Foundation: Complete (Authentication, Supabase, Network Status)
- Existing MoodTracker component at `src/components/MoodTracker/MoodTracker.tsx`
- MoodSlice at `src/stores/slices/moodSlice.ts`
- MoodService at `src/services/moodService.ts`

**Gap Analysis from Tech Spec**:
1. **Database Schema Gap**: Supabase `moods.mood_type` CHECK constraint allows only 5 positive moods - needs migration
2. **Emotion Count Gap**: PRD specifies 12 emotions, current implementation has 10 - need 2 additional moods (`excited`, `calm`)
3. **Grid Layout**: Current MoodTracker UI may not be optimized for 3x4 grid with proper visual grouping

---

## Acceptance Criteria

| AC ID | Criteria | Validation Method |
|-------|----------|-------------------|
| **AC-5.1.1** | 12 emotion emojis displayed in 3x4 grid layout | Visual inspection + E2E test |
| **AC-5.1.2** | Each emoji has icon, label, and minimum 48px touch target | Accessibility audit (axe) |
| **AC-5.1.3** | Selected mood(s) show pink border and scale animation | Visual inspection + snapshot test |
| **AC-5.1.4** | Multiple moods can be selected (multi-select mode) | E2E test + manual verification |
| **AC-5.1.5** | Positive moods grouped separately from challenging moods | Visual inspection |
| **AC-5.1.6** | Selected moods display summary below grid | Visual inspection |

---

## Implementation Tasks

### **Task 1: Expand MoodType to 12 Emotions** (AC-5.1.1, AC-5.1.5)
**Goal**: Add `excited` and `calm` mood types to complete the 12-emotion set

- [ ] **1.1** Update `MoodType` in `src/types/index.ts`:
  ```typescript
  export type MoodType =
    // Positive emotions (6)
    | 'loved' | 'happy' | 'content' | 'grateful' | 'excited' | 'calm'
    // Challenging emotions (6)
    | 'sad' | 'anxious' | 'frustrated' | 'lonely' | 'tired' | 'thoughtful';
  ```
- [ ] **1.2** Update `POSITIVE_MOODS` array in `MoodTracker.tsx` to include `excited`, `calm`
- [ ] **1.3** Update `NEGATIVE_MOODS` array (now `CHALLENGING_MOODS`) with correct 6 emotions
- [ ] **1.4** Add icon mappings for new moods:
  - `excited`: Star icon (Lucide `Star`)
  - `calm`: Moon icon (Lucide `Moon`)

### **Task 2: Create Supabase Migration** (AC-5.1.1)
**Goal**: Update database CHECK constraint to accept all 12 mood types

- [ ] **2.1** Create migration file `docs/99-migrations/004_expand_mood_types.sql`:
  ```sql
  -- Migration: 004_expand_mood_types.sql
  -- Purpose: Expand mood_type CHECK constraint to support all 12 emotions

  ALTER TABLE moods DROP CONSTRAINT IF EXISTS moods_mood_type_check;

  ALTER TABLE moods ADD CONSTRAINT moods_mood_type_check
  CHECK (mood_type IN (
    'loved', 'happy', 'content', 'grateful', 'excited', 'calm',
    'sad', 'anxious', 'frustrated', 'lonely', 'tired', 'thoughtful'
  ));

  CREATE INDEX IF NOT EXISTS idx_moods_created_desc ON moods(created_at DESC);
  ```
- [ ] **2.2** Apply migration to Supabase project via Dashboard SQL Editor

### **Task 3: Enhance MoodTracker Grid Layout** (AC-5.1.1, AC-5.1.2, AC-5.1.5)
**Goal**: Implement proper 3x4 grid with grouped moods and accessibility

- [ ] **3.1** Update MoodTracker component with 3x4 Tailwind grid layout:
  - `grid grid-cols-3 gap-3` for emoji buttons
  - Group positive moods (row 1-2) and challenging moods (row 3-4)
- [ ] **3.2** Add visual section divider or subtle background difference between mood groups
- [ ] **3.3** Ensure minimum touch target 48x48px via Tailwind (`min-w-12 min-h-12`)
- [ ] **3.4** Add `aria-label` to each mood button for screen reader accessibility
- [ ] **3.5** Add group labels: "Positive" and "Challenging" above each section

### **Task 4: Implement Selection Visual Feedback** (AC-5.1.3, AC-5.1.4)
**Goal**: Visual feedback for mood selection with multi-select support

- [ ] **4.1** Update mood button styling for selected state:
  - Pink border: `border-2 border-pink-500`
  - Scale animation: Framer Motion `whileTap={{ scale: 0.95 }}` and `animate={{ scale: selected ? 1.1 : 1 }}`
- [ ] **4.2** Ensure multi-select mode works (existing behavior or update):
  - Track `selectedMoods: MoodType[]` state
  - Toggle selection on click
- [ ] **4.3** Add vibration feedback on selection (follow pattern from existing MoodTracker):
  - `navigator.vibrate(15)` on mood button tap

### **Task 5: Add Selected Moods Summary** (AC-5.1.6)
**Goal**: Display summary of selected moods below the grid

- [ ] **5.1** Create summary section below emoji grid:
  - Show selected mood icons in a horizontal row
  - Display count: "X mood(s) selected"
  - Show when at least one mood selected
- [ ] **5.2** Add "Clear selection" link/button in summary area

### **Task 6: Verify IndexedDB Schema Compatibility**
**Goal**: Ensure local storage accepts new mood types

- [ ] **6.1** Check `MoodEntrySchema` in moodService.ts accepts expanded MoodType
- [ ] **6.2** Verify no validation failures when saving new mood types to IndexedDB
- [ ] **6.3** Test saving `excited` and `calm` moods locally

### **Task 7: Add Unit and E2E Tests**
**Goal**: Test coverage for new functionality

- [ ] **7.1** Add unit test for MoodType validation (all 12 types)
- [ ] **7.2** Add component test for MoodTracker grid rendering 12 buttons
- [ ] **7.3** Add E2E test verifying:
  - All 12 moods visible
  - Multi-select works
  - Selection visual feedback appears

---

## Dev Notes

### Architecture Patterns and Constraints

**Technology Stack** (from Architecture doc):
- **React 19 + Vite 7** - Modern web stack
- **Tailwind CSS 3.4** - Utility-first styling
- **Framer Motion 12** - Animations and gestures
- **Zustand 5** - State management with MoodSlice
- **Lucide React** - Icon library (Star, Moon for new moods)

**Component Location**:
- Main component: `src/components/MoodTracker/MoodTracker.tsx`
- Mood button: `src/components/MoodTracker/MoodButton.tsx` (if exists)
- Types: `src/types/index.ts`

**Mood Icon Mapping** (from Tech Spec):
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

### Project Structure Notes

**Files to Modify:**
```
src/
├── types/
│   └── index.ts                        # Add excited, calm to MoodType
├── components/
│   └── MoodTracker/
│       └── MoodTracker.tsx             # Update grid, add new moods
├── services/
│   └── moodService.ts                  # Verify IndexedDB schema
docs/
└── 99-migrations/
    └── 004_expand_mood_types.sql       # Database migration (NEW)
```

**Testing Files to Create:**
```
src/
├── types/__tests__/
│   └── MoodType.test.ts                # MoodType validation tests
tests/
└── e2e/
    └── mood-emoji-picker.spec.ts       # E2E for 12-emoji grid
```

### Learnings from Previous Story

**From Story 1-5-network-status-indicator-offline-resilience (Status: done)**

**Patterns to REUSE**:
- `useNetworkStatus` hook available at `src/hooks/useNetworkStatus.ts`
- `NetworkStatusIndicator` component at `src/components/shared/`
- Offline error handling pattern in MoodTracker.tsx (retry button)
- UX colors: Success #51CF66, Warning #FCC419, Error #FF6B6B

**MoodTracker Already Has**:
- Offline error handling with retry button using `WifiOff` icon
- Background sync registration via `registerBackgroundSync('sync-pending-moods')`
- Integration with `offlineErrorHandler.ts`

**Technical Context from Story 1.5**:
- Hook patterns use `useState`, `useEffect`, `useCallback`, `useRef`
- Component patterns with `role="status"`, `aria-live` for accessibility
- Shared components export from `src/components/shared/index.ts`

### Testing Standards

**Unit Testing**:
- Test file pattern: `*.test.ts` or `*.test.tsx`
- Location: Co-located `__tests__/` directories or `tests/unit/`
- Framework: Vitest

**E2E Testing**:
- Test file pattern: `*.spec.ts`
- Location: `tests/e2e/`
- Framework: Playwright
- Test selectors: `data-testid` attributes

### References

**Source Documents**:
- **Tech Spec**: [docs/05-Epics-Stories/tech-spec-epic-5.md](./tech-spec-epic-5.md) - Story 5.1 section
- **Epic Source**: [docs/05-Epics-Stories/epics.md](./epics.md) - Epic 5: Story 5.1
- **Architecture**: [docs/02-Architecture/architecture.md](../02-Architecture/architecture.md) - Zustand patterns
- **PRD**: [docs/01-PRD/prd.md](../01-PRD/prd.md) - FR22 (12 emotion options)
- **UX Spec**: [docs/09-UX-Spec/ux-design-specification.md](../09-UX-Spec/ux-design-specification.md) - Mood Tracker UI

**Key Functional Requirements Covered**:
- **FR22**: Users can log current mood by selecting from 12 emotion options (AC-5.1.1, AC-5.1.2)
- **FR23**: Users can optionally add brief text note with mood entry (existing, not this story's scope but enabled)

---

## Dev Agent Record

### Context Reference

- **Story Context XML**: [5-1-mood-emoji-picker-interface.context.xml](./5-1-mood-emoji-picker-interface.context.xml) - Generated 2025-11-25

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-11-25 | Claude Opus 4.5 (BMad Workflow) | Story created from tech-spec-epic-5.md via create-story workflow |
| 2025-11-25 | Claude Opus 4.5 (story-context) | Story context XML generated with full implementation guidance |
