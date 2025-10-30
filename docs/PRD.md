# My-Love Product Requirements Document (PRD)

**Author:** Frank
**Date:** 2025-10-30
**Project Level:** 2
**Target Scale:** Medium feature set (5-15 stories)

---

## Goals and Background Context

### Goals

- **Address Technical Debt**: Audit and refactor vibe-coded prototype for production quality
- **Fix Core Persistence**: Resolve data persistence issues so app state survives browser sessions
- **Eliminate Onboarding Friction**: Pre-configure relationship data so your girlfriend never sees setup screens
- **Enrich Daily Experience**: Expand to 365 unique messages and add swipe navigation for exploring messages
- **Enable Memory Sharing**: Build photo gallery with smooth animated transitions and carousel-style browsing
- **Track Relationship Milestones**: Implement countdown timers to anniversaries and significant dates
- **Facilitate Emotional Connection**: Add mood tracking she can log and you can see, plus "poke/kiss" animations for spontaneous connection
- **Personalize Message Library**: Enable you to review, edit, and create custom messages that integrate into daily rotation

### Background Context

My Love is a personal Progressive Web Application created to strengthen your relationship through daily expressions of love and appreciation. The v0.1.0 foundation was rapidly prototyped to validate the core concept of daily rotating messages, and it successfully demonstrates the emotional impact of consistent, heartfelt touchpoints.

However, the current implementation has critical usability issues that prevent it from being production-ready: data doesn't persist across sessions, and the onboarding flow creates unnecessary friction for the single intended user (your girlfriend). Additionally, the limited message library (100 messages) and lack of interactive features limit long-term engagement. This PRD defines the roadmap to transform the promising prototype into a polished, feature-rich application that serves as a daily source of connection, celebration, and emotional intimacy.

---

## Requirements

### Functional Requirements

**Core Data Persistence**
- FR001: System SHALL persist all user data (messages, photos, mood entries, settings) across browser sessions using IndexedDB and LocalStorage
- FR002: System SHALL correctly hydrate Zustand state from persisted storage on app initialization
- FR003: System SHALL handle storage quota limits gracefully with user notification

**Pre-Configured Experience**
- FR004: System SHALL eliminate onboarding flow by pre-configuring relationship data (partner name, relationship start date) at build/deploy time
- FR005: System SHALL display relationship duration automatically without user input

**Message Library & Navigation**
- FR006: System SHALL maintain library of 365 unique love messages across 5 categories (reasons, memories, affirmations, future plans, custom)
- FR007: System SHALL display one message per day based on date-based rotation algorithm
- FR008: System SHALL support horizontal swipe gestures to navigate to previous days' messages (backward navigation only)
- FR009: System SHALL prevent forward navigation to future unread messages
- FR010: System SHALL allow users to favorite messages with visual indication
- FR011: System SHALL enable message sharing via native share API or clipboard copy

**Photo Gallery**
- FR012: System SHALL allow users to upload photos with captions and optional tags
- FR013: System SHALL display photos in carousel/gallery view with smooth animated transitions
- FR014: System SHALL store photos in IndexedDB with compression for optimal storage
- FR015: System SHALL provide navigation interface to access photo gallery from main app

**Anniversary Countdown**
- FR016: System SHALL calculate and display countdown to next anniversary (days, hours, minutes)
- FR017: System SHALL support multiple custom countdowns for special dates
- FR018: System SHALL trigger celebration animations when countdown reaches zero

**Mood Tracking & Sync**
- FR019: System SHALL allow user to log daily mood (5 mood types: loved, happy, content, thoughtful, grateful)
- FR020: System SHALL sync mood entries to NocoDB backend for partner visibility
- FR021: System SHALL display mood history in calendar view
- FR022: System SHALL support optional notes with each mood entry

**Interactive Connection Features**
- FR023: System SHALL support "poke" and "kiss" actions that send notifications to partner via NocoDB
- FR024: System SHALL display animated reactions when poke/kiss is received
- FR025: System SHALL maintain interaction history for sentimental value

**Custom Message Management**
- FR026: System SHALL allow admin user (you) to review AI-generated message suggestions
- FR027: System SHALL provide accept/decline interface for message curation
- FR028: System SHALL enable creation of custom messages with category selection
- FR029: System SHALL allow editing of existing messages in library
- FR030: System SHALL integrate approved custom messages into daily rotation algorithm

**Navigation & UI**
- FR031: System SHALL provide top navigation bar to access: Home, Photos, Mood Tracker, Settings
- FR032: System SHALL maintain consistent theme across all views
- FR033: System SHALL support all 4 existing themes (Sunset Bliss, Ocean Dreams, Lavender Fields, Rose Garden)

### Non-Functional Requirements

- NFR001: **Performance** - App SHALL load in under 2 seconds on 3G connection, maintain 60fps animations
- NFR002: **Offline Support** - App SHALL function fully offline after initial load (except mood sync and poke/kiss features)
- NFR003: **Browser Compatibility** - App SHALL support latest 2 versions of Chrome, Firefox, Safari, Edge
- NFR004: **Mobile Responsiveness** - App SHALL provide optimized experience for mobile viewports (320px-428px width)
- NFR005: **Data Privacy** - App SHALL store personal data (photos, messages) client-side only; sync only mood and interaction data
- NFR006: **Code Quality** - App SHALL maintain TypeScript strict mode, ESLint compliance, and <10% code duplication

---

## User Journeys

### Journey 1: Daily Message Experience (Primary Use Case)

**Actor:** Your girlfriend
**Trigger:** Opens app in the morning
**Goal:** See today's love message and optionally explore previous messages

**Happy Path:**

1. Opens My Love PWA from home screen (or browser bookmark)
2. App loads instantly - cached offline (NFR002)
3. Sees today's message displayed with:
   - Relationship duration counter "87 days together" (FR005)
   - Daily message card with category badge (FR007)
   - Smooth entrance animation (NFR001)
4. Reads the heartfelt message
5. Smiles and taps the heart icon to favorite it (FR010)
   - Heart bursts with floating hearts animation
6. Swipes left to see yesterday's message (FR008)
   - Smooth transition animation
   - Can continue swiping back through message history
7. Tries to swipe right beyond today - blocked with subtle indicator (FR009)
8. Navigates to Mood Tracker tab (FR031)
9. Logs mood as "Loved" with note "Made my morning ❤️" (FR019, FR022)
   - Mood syncs to NocoDB backend (FR020)
10. Sees notification badge - you sent her a "kiss" (FR023)
11. Taps to see kiss animation play (FR024)
12. Sends you a "kiss" back (FR023)
13. Closes app feeling connected and appreciated

**Alternative Flows:**
- If first visit of the day: sees new message (FR007)
- If returning later: sees same message as earlier - one per day (FR007)
- If offline: everything works except mood sync and poke/kiss features (NFR002, FR020, FR023)

---

## UX Design Principles

- **Romantic & Intimate:** Every interaction should feel personal, warm, and emotionally resonant - this is a private expression of love
- **Delightfully Smooth:** Animations and transitions should be fluid and polished (60fps), creating a premium feel
- **Effortlessly Simple:** Zero cognitive load - girlfriend never thinks about how to use it, just enjoys the experience
- **Mobile-First:** Optimized for phone usage since that's the primary access point; thumb-friendly touch targets
- **Emotionally Rewarding:** Interactions provide instant positive feedback through animations, sounds (optional), and visual delight

---

## User Interface Design Goals

- Maintain existing romantic color themes (Sunset Bliss, Ocean Dreams, Lavender Fields, Rose Garden)
- Visually rich UI with focus on content (messages, photos, countdowns) - not minimal, beautifully decorated
- Gesture-driven navigation (swipes feel natural and discoverable)
- Top navigation bar for feature access without cluttering main view
- Consistent animation language across all features
- Dark mode consideration for evening use (optional future enhancement)

---

## Epic List

### Epic 1: Foundation & Core Fixes (Est. 5-7 stories)
Fix technical debt, persistence issues, and eliminate onboarding friction to create stable production-ready base.

### Epic 2: Enhanced Message Experience (Est. 4-6 stories)
Expand message library to 365 messages, implement swipe navigation, and add custom message management interface.

### Epic 3: Photo Gallery & Memories (Est. 3-5 stories)
Build photo upload, storage, and carousel gallery with animated transitions and navigation integration.

### Epic 4: Interactive Connection Features (Est. 4-6 stories)
Implement mood tracking with NocoDB sync, poke/kiss interactions, and anniversary countdown timers.

**Total Estimated Stories:** 16-24 stories across 4 epics

> **Note:** Detailed epic breakdown with full story specifications is available in [epics.md](./epics.md)

---

## Out of Scope

The following features are explicitly excluded from this project phase:

**Multi-User & Social Features**
- Multi-user functionality (app remains single-user focused on your girlfriend)
- Social sharing features or public galleries
- Cross-device sync (data stays local to each device)
- User authentication system (not needed for single-user app)

**Monetization & Analytics**
- Any monetization features or ads
- Analytics or telemetry tracking
- Third-party integrations beyond NocoDB

**Advanced Features (Future Consideration)**
- Video uploads or playback
- Voice messages or audio features
- Push notifications from NocoDB backend (may add later)
- Calendar integration for anniversaries
- Data export/import functionality
- Theming beyond the 4 existing themes

**Platform Expansion**
- Native mobile apps (PWA is sufficient)
- Desktop-specific features
- Smart watch or wearable integrations

**Note:** Some out-of-scope items may be reconsidered for future versions based on usage and feedback.
