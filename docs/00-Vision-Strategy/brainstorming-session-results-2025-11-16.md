# Brainstorming Session Results

**Session Date:** 2025-11-16
**Facilitator:** Business Analyst Mary
**Participant:** Frank

## Session Start

**Approach Selected:** AI-Facilitated Strategic Discovery
**Focus:** Evolving My-Love web app into native iOS/Android mobile app using React Native + Expo
**Method:** Expert-guided strategic questioning to clarify architectural and UX decisions before PRD creation

## Executive Summary

**Topic:** Mobile App Migration Strategy - My-Love (React Native + Expo + Supabase + TanStack Query)

**Session Goals:**

- Define database architecture (Supabase + caching strategy)
- Clarify new Love Notes feature requirements
- Establish data sharing/privacy model for 2-person app
- Identify MVP scope and feature priorities
- Surface technical risks and unknowns

**Techniques Used:** Strategic Questioning, Expert Analysis, Feature Mapping, Architecture Decision Trees, First Principles Analysis, Devil's Advocate, Weighted Decision Matrix

**Total Ideas Generated:** 25+ strategic decisions and feature specifications (including architecture pivot and complete tech stack selection)

### Key Themes Identified:

1. **Simplified Architecture** - Supabase + TanStack Query for online-first with smart caching (simplified from PowerSync after analysis)
2. **Full Partnership Transparency** - Shared moods, photos, notes; no private silos
3. **Existing Infrastructure Reuse** - Authentication, partner pairing, date configuration already in place
4. **Real-Time First** - Love Notes and all features rely on Supabase real-time with caching fallback
5. **Comprehensive Notifications** - All notification types (daily messages, Love Notes, mood reminders, milestones)

## Technique Sessions

### Session 1: Database Architecture Analysis

**Technique:** Expert-Guided Decision Tree → Advanced Elicitation (First Principles + Devil's Advocate)
**Duration:** ~25 minutes (including architecture pivot)

**Initial Discovery:** Supabase + PowerSync hybrid approach considered

**Architecture Pivot (via Advanced Elicitation):**
After First Principles analysis questioned PowerSync necessity and Devil's Advocate stress-tested the decision, Frank clarified: _"I expect to really never be offline"_

**Final Decision:** Supabase + TanStack Query (simplified from PowerSync)

**Key Decisions:**

- **Supabase handles:** Auth, Database, Real-time subscriptions, Photo Storage, Push notifications
- **TanStack Query handles:** Caching responses, background refetch, optimistic updates
- **No offline-first sync layer** - Online-first with smart caching is sufficient
- **No Zustand** - React's built-in useState/useContext sufficient for client state

**State Management Strategy:**

- Server state → TanStack Query
- Client state → React useState/useContext
- No additional state management library needed for MVP

**Rationale:** Simpler architecture matching actual usage patterns. PowerSync's offline-first complexity unnecessary for always-connected use case. TanStack Query provides 80% of benefits with 20% of complexity. Zustand unnecessary for small app with primarily server-side state.

---

### Session 2: Feature Behavior Specification

**Technique:** Strategic Questioning with Options Analysis
**Duration:** ~15 minutes

**Decisions Made:**

| Feature                | Decision              | Details                                                |
| ---------------------- | --------------------- | ------------------------------------------------------ |
| **Love Notes**         | Hybrid sync (C)       | Offline writing + real-time when both online           |
| **Mood Tracker**       | Full transparency (A) | Both users see each other's mood entries               |
| **Photo Gallery**      | Shared gallery (B)    | Bi-directional sync - both see all photos              |
| **Push Notifications** | All types             | Daily messages, Love Notes, mood reminders, milestones |

---

### Session 3: Authentication & Infrastructure Review

**Technique:** Existing System Inventory
**Duration:** ~5 minutes

**Critical Discovery:** Minimal new infrastructure needed!

- Partner pairing: Already exists (Partner tab configuration)
- Relationship date: Developer sets (option C)
- Authentication: Supabase accounts already exist
- Data ownership: Simplest approach for MVP (assumes eternal love)

**Implication:** Mobile app is UI rebuild, not infrastructure rebuild

---

### Session 4: Advanced Elicitation - Architecture Stress Test

**Technique:** First Principles + Devil's Advocate (Combined)
**Duration:** ~15 minutes

**Trigger:** Checkpoint after initial architecture decision - Frank selected Advanced Elicitation for deeper analysis

**First Principles Analysis Revealed:**

- Migration is "new app with shared logic library" NOT "porting web app"
- Only ~30% of code truly reusable (pure logic, types, constants)
- ~70% is NEW native code (UI, navigation, storage layer)
- PowerSync adds complexity that may not be justified

**Devil's Advocate Challenges:**

- "PowerSync is overkill for 2 users"
- "Supabase real-time is sufficient"
- "You're coupling to two external services"
- "SQLite + custom sync would be simpler"

**Alternatives Explored:**

- Firebase (requires Supabase migration)
- PocketBase (requires backend migration)
- Supabase + Custom sync (Steam Cloud model)
- Supabase + TanStack Query (simple caching)

**Critical Question:** "How often do you expect to be offline?"
**Frank's Answer:** "I expect to really never be offline"

**Result:** Architecture simplified from PowerSync to TanStack Query

**Additional Simplification:** No Zustand needed

- TanStack Query handles server state
- React's built-in useState/useContext handles client state
- Small app with primarily server-side data doesn't justify additional state management library

**Key Learning:** Challenge assumptions early. Offline-first architecture was solving a problem that doesn't exist in this use case. Similarly, Zustand adds complexity for state management that React Native handles natively.

---

### Session 5: Tech Stack Decision Matrix

**Technique:** Weighted Decision Matrix
**Duration:** ~10 minutes

**Purpose:** Systematically evaluate remaining tech stack choices using objective criteria

#### Navigation Library Decision

**Options Evaluated:** Expo Router vs React Navigation

| Criteria           | Weight (1-5) | Expo Router Score         | React Navigation Score |
| ------------------ | ------------ | ------------------------- | ---------------------- |
| Learning Curve     | 4            | 5 (file-based, intuitive) | 3 (more config)        |
| Expo Integration   | 5            | 5 (built for Expo)        | 4 (compatible)         |
| File-Based Routing | 3            | 5 (core feature)          | 2 (manual)             |
| Type Safety        | 3            | 4                         | 5                      |
| Documentation      | 4            | 4                         | 5                      |
| Community Support  | 3            | 3 (growing)               | 5 (established)        |
| Future Maintenance | 4            | 5 (Expo backing)          | 4                      |

**Final Scores:** Expo Router: **117/130** vs React Navigation: **104/130**

**Winner:** Expo Router - File-based routing aligns with modern patterns, native Expo integration, easier learning curve for non-developer

#### Local Storage Decision

**Options Evaluated:** MMKV vs AsyncStorage

**MMKV: 96/105 | AsyncStorage: 85/105**

**Recommendation:** MMKV for performance (10x faster, sync API), but AsyncStorage acceptable for MVP if MMKV setup proves complex

#### Final Tech Stack (Consolidated)

| Category               | Choice                       | Status                       |
| ---------------------- | ---------------------------- | ---------------------------- |
| **Framework**          | React Native + Expo          | ✅ Confirmed                 |
| **Navigation**         | Expo Router                  | ✅ Decision Matrix Winner    |
| **Backend**            | Supabase                     | ✅ Existing infrastructure   |
| **Server State**       | TanStack Query               | ✅ Simplified from PowerSync |
| **Client State**       | React useState/useContext    | ✅ No Zustand needed         |
| **Local Storage**      | MMKV (AsyncStorage fallback) | ✅ Performance priority      |
| **Push Notifications** | Expo Notifications           | ✅ Expo-native               |
| **Build System**       | EAS Build                    | ✅ Standard for Expo         |

---

### Session 6: Pre-mortem Risk Analysis

**Technique:** Pre-mortem Analysis
**Duration:** ~10 minutes

**Scenario:** It's 3 months post-launch. The My-Love mobile app has FAILED. What went wrong?

**Failure Scenario 1: App Store Rejection**

- **What happened:** Apple rejected the app for privacy policy issues
- **Warning signs:** Insufficient data usage disclosure, missing privacy labels
- **Preventive measures:** Draft comprehensive privacy policy covering photo storage, mood data, chat messages; complete App Store privacy questionnaire; test with TestFlight first

**Failure Scenario 2: Authentication Breaks**

- **What happened:** Deep linking for Supabase auth fails on iOS
- **Warning signs:** Works in Expo Go but not production build
- **Preventive measures:** Test auth flow in EAS preview builds early; configure URL schemes correctly; have fallback email/password flow

**Failure Scenario 3: Data Sync Issues**

- **What happened:** TanStack Query cache gets stale, users see old data
- **Warning signs:** Inconsistent state between partners, "she says she sent a note but I don't see it"
- **Preventive measures:** Implement Supabase real-time subscriptions for Love Notes; set aggressive cache invalidation; add pull-to-refresh everywhere

**Failure Scenario 4: Push Notification Failures**

- **What happened:** Notifications don't arrive reliably
- **Warning signs:** iOS background restrictions, Android battery optimization
- **Preventive measures:** Test on physical devices in production mode; handle permission requests gracefully; provide in-app notification history as backup

**Failure Scenario 5: Performance Issues**

- **What happened:** App feels sluggish, especially photo gallery
- **Warning signs:** Large photo uploads, unoptimized images, too many re-renders
- **Preventive measures:** Implement image compression before upload; use FlatList with proper optimization; lazy load gallery; measure with React Native Debugger

**Failure Scenario 6: Privacy/Data Concerns**

- **What happened:** Partner feels uncomfortable with mood transparency
- **Warning signs:** User requests to hide certain moods or notes
- **Preventive measures:** Confirm 100% transparency model with both users before launch; this is a feature, not a bug; document the shared philosophy upfront

---

### Session 7: Journey Mapping

**Technique:** Journey Mapping
**Duration:** ~10 minutes

**User Journey: Frank's Daily Experience**

| Stage            | Touchpoint        | Action                     | Emotion     | Pain Points             | Opportunities             |
| ---------------- | ----------------- | -------------------------- | ----------- | ----------------------- | ------------------------- |
| Morning (7 AM)   | Push notification | Receive daily love message | Warm, loved | None                    | Perfect start to day      |
| Morning (8 AM)   | Mood tracker      | Log morning mood           | Reflective  | Quick access needed     | Widget for fast entry?    |
| Commute (9 AM)   | Love Notes        | Send "thinking of you"     | Connected   | Typing on phone         | Voice notes feature?      |
| Midday (12 PM)   | Photo gallery     | Share lunch photo          | Playful     | Upload speed            | Show upload progress      |
| Afternoon (3 PM) | Love Notes        | Receive partner's note     | Delighted   | Want notification sound | Custom notification tones |
| Evening (6 PM)   | Dashboard         | Check partner's mood       | Caring      | Want quick glance       | Dashboard summary view    |
| Night (10 PM)    | Love Notes        | Goodnight message          | Peaceful    | None                    | Perfect closure           |

**User Journey: Girlfriend's Daily Experience**

| Stage             | Touchpoint    | Action                         | Emotion         | Pain Points               | Opportunities             |
| ----------------- | ------------- | ------------------------------ | --------------- | ------------------------- | ------------------------- |
| Morning (6:30 AM) | App open      | Check if Frank logged mood     | Curious, caring | Waiting for his update    | Notification when he logs |
| Morning (7:15 AM) | Mood tracker  | Log her morning mood           | Expressive      | Want more mood options?   | Custom mood categories    |
| Midday (11 AM)    | Love Notes    | Sees Frank's "thinking of you" | Happy, valued   | None                      | Read receipts?            |
| Midday (12:30 PM) | Photo gallery | Sees lunch photo               | Amused          | Gallery load time         | Thumbnail previews        |
| Afternoon (4 PM)  | Love Notes    | Send encouragement note        | Supportive      | None                      | Heart reactions?          |
| Evening (7 PM)    | Dashboard     | Review shared memories         | Nostalgic       | Scrolling through history | Timeline view feature?    |
| Night (9:30 PM)   | Love Notes    | Reply goodnight                | Content         | None                      | Good flow                 |

**Key Journey Insights:**

1. **Quick access is critical** - Both users need fast mood logging (< 5 seconds)
2. **Notifications are the heartbeat** - Push notifications drive engagement throughout day
3. **Photo upload experience matters** - Clear progress indicators needed
4. **Dashboard is daily check-in hub** - Design for at-a-glance information
5. **Love Notes are core engagement** - Real-time delivery is non-negotiable
6. **Evening reflection is valuable** - Consider "day summary" feature for future

## Idea Categorization

### Immediate Opportunities

_Ideas ready to implement now_

1. **Core App Structure** - React Native + Expo with Expo Router file-based navigation
2. **Supabase Integration** - Leverage existing auth, database, and storage infrastructure
3. **TanStack Query Setup** - Server state management with smart caching and optimistic updates
4. **Love Notes Feature** - Real-time chat using Supabase Realtime subscriptions
5. **Mood Tracker** - Full transparency model with shared mood entries between partners
6. **Photo Gallery** - Bi-directional shared gallery with Supabase Storage
7. **Push Notifications** - Daily messages, Love Notes alerts, mood reminders via Expo Notifications
8. **MMKV Local Storage** - Fast key-value storage for preferences and cached data

### Future Innovations

_Ideas requiring development/research_

1. **Widget for Quick Mood Entry** - iOS/Android home screen widgets for < 5 second mood logging
2. **Custom Notification Tones** - Personalized sounds for different notification types
3. **Voice Notes** - Audio messages in Love Notes for easier mobile communication
4. **Read Receipts** - Visual confirmation when partner has seen Love Notes
5. **Heart Reactions** - Quick emoji responses to Love Notes
6. **Dashboard Summary View** - At-a-glance partner status and recent activity
7. **Timeline View** - Chronological journey through shared memories
8. **Notification When Partner Logs Mood** - Real-time awareness of partner's activity

### Moonshots

_Ambitious, transformative concepts_

1. **Relationship Analytics Dashboard** - Patterns, trends, and insights from mood/chat data over time
2. **AI-Generated Love Messages** - Personalized daily messages based on relationship patterns
3. **Shared Calendar Integration** - Important dates, anniversaries, and relationship milestones
4. **Collaborative Memory Books** - Export shared photos/notes into digital scrapbooks
5. **Relationship Health Score** - Gamified engagement metrics (tread carefully on privacy)
6. **Cross-Platform Desktop Companion** - Electron app for desktop access

### Insights and Learnings

_Key realizations from the session_

1. **Simplicity Wins** - PowerSync and Zustand were unnecessary complexity for an always-online use case. Question every dependency before adding it.

2. **Migration is Reimagining** - This isn't "porting the web app" but building a "new native app with shared business logic." ~70% is new code.

3. **Existing Infrastructure is Gold** - Authentication, partner pairing, and relationship configuration already exist. Focus on UI/UX, not rebuilding backend.

4. **Online-First is Perfectly Valid** - Offline-first sync is complex and unnecessary when users expect constant connectivity. TanStack Query + Supabase Realtime is sufficient.

5. **Two Users Simplifies Everything** - No need for scaling concerns, complex permissions, or multi-tenancy. Optimize for intimacy, not growth.

6. **Transparency is a Feature** - Full visibility into partner's moods and messages builds trust. This is intentional design, not a privacy issue.

7. **Notifications Drive Engagement** - Push notifications are the heartbeat of daily interaction. Invest heavily in making them reliable.

8. **Pre-mortem Reveals Blind Spots** - App Store rejection, auth deep linking issues, and cache staleness are real risks that need upfront mitigation.

9. **Journey Mapping Identifies UX Priorities** - Quick mood logging (< 5 seconds), reliable Love Notes delivery, and dashboard at-a-glance views are critical paths.

## Action Planning

### Top 3 Priority Ideas

#### #1 Priority: Core App Foundation with Simplified Architecture

- Rationale: Everything else depends on getting the foundation right. The simplified Supabase + TanStack Query architecture reduces complexity while maintaining all needed functionality. This decision de-risks the entire project.
- Next steps:
  1. Initialize Expo project with TypeScript template
  2. Configure Expo Router with file-based routing structure
  3. Set up TanStack Query with Supabase client
  4. Implement authentication flow with deep linking
  5. Create shared hooks for Supabase real-time subscriptions
  6. Configure MMKV for local storage
- Resources needed: Expo CLI, EAS account, Apple Developer account, existing Supabase project credentials, TanStack Query docs, React Native development environment
- Timeline: 1-2 weeks for foundation, then iterative feature development

#### #2 Priority: Love Notes Real-Time Feature

- Rationale: This is the primary NEW feature that differentiates the mobile app from the web version. It's the most requested feature and drives daily engagement. Real-time delivery is critical for emotional connection.
- Next steps:
  1. Design Supabase table schema for messages (with read receipts consideration)
  2. Implement Supabase Realtime subscription for live message delivery
  3. Build chat UI with optimistic updates via TanStack Query
  4. Configure push notifications for new messages
  5. Test real-time sync between two devices
  6. Handle edge cases (network drops, message ordering, cache invalidation)
- Resources needed: Supabase Realtime documentation, Expo Notifications setup, two test devices (iOS and Android)
- Timeline: 2-3 weeks including testing on physical devices

#### #3 Priority: Push Notification Infrastructure

- Rationale: Notifications are the "heartbeat" of daily engagement per journey mapping. All features depend on reliable notifications: daily messages, Love Notes alerts, mood reminders, and milestones. Pre-mortem identified notification failures as a critical risk.
- Next steps:
  1. Set up Expo Notifications with EAS
  2. Request permissions gracefully with clear value proposition
  3. Implement server-side trigger for daily love messages
  4. Configure notification handlers for foreground/background states
  5. Test on physical iOS and Android devices in production mode
  6. Create in-app notification history as backup
- Resources needed: Expo Notifications docs, Supabase Edge Functions for scheduled triggers, physical test devices, EAS Push credentials
- Timeline: 1-2 weeks, parallel with Love Notes development

## Reflection and Follow-up

### What Worked Well

1. **Advanced Elicitation (First Principles + Devil's Advocate)** - This combination was the breakthrough moment. Questioning the PowerSync assumption and stress-testing with "how often are you offline?" led to the architecture pivot that simplified everything.

2. **Decision Matrix Method** - Provided objective, weighted scoring for Expo Router vs React Navigation. Removed gut-feeling bias and gave confidence in the choice.

3. **Strategic Questioning with Options** - Rapidly clarified feature behaviors (Love Notes sync model, mood transparency, photo sharing) by presenting concrete alternatives.

4. **Pre-mortem Analysis** - Identified 6 specific failure scenarios with actionable preventive measures. App Store rejection and auth deep linking issues are now on the radar early.

5. **Journey Mapping** - Revealed that notifications are the "heartbeat" of daily engagement. Quick mood logging (< 5 seconds) became a clear UX requirement.

6. **Iterative Simplification** - Each technique helped strip away unnecessary complexity: PowerSync → TanStack Query, Zustand → React built-ins, offline-first → online-first.

### Areas for Further Exploration

1. **Database Schema Design** - Exact Supabase table structures for Love Notes, mood entries, and photo metadata
2. **Deep Linking Configuration** - Specific URL scheme setup for iOS and Android authentication flows
3. **App Store Submission Requirements** - Privacy policy template, App Store Connect metadata, TestFlight beta testing process
4. **Performance Benchmarking** - Measure actual photo upload speeds, message delivery latency, and cache hit rates
5. **Accessibility Compliance** - WCAG standards for mood tracker, chat interface, and photo gallery
6. **Partner Onboarding Flow** - How does the second user (girlfriend) get invited and paired?

### Recommended Follow-up Techniques

1. **Prototyping** - Build clickable wireframes for Love Notes chat UI and mood tracker to validate quick-access hypothesis
2. **Technical Spike** - Proof-of-concept for Supabase Realtime + TanStack Query integration to validate architecture
3. **User Story Mapping** - Break down the three priorities into specific user stories for development tracking
4. **Risk Register** - Formal risk tracking document based on pre-mortem findings
5. **Data Flow Diagram** - Visual representation of how data moves through Supabase → TanStack Query → UI
6. **Competitive Analysis** - Brief look at other couples apps (Paired, Between, Couple) for UX inspiration

### Questions That Emerged

1. How will deep linking work for Supabase magic links in production Expo builds?
2. What's the exact Supabase Realtime subscription pattern for chat messages?
3. How do we handle notification permissions if user denies initially?
4. What's the image compression strategy before uploading to Supabase Storage?
5. Do we need Row Level Security (RLS) policies for partner-only data access?
6. How are daily love messages triggered? Supabase Edge Function cron job?
7. What happens to data if the relationship ends? (Intentionally ignored for MVP, but future consideration)
8. Should Love Notes support message editing/deletion?

### Next Session Planning

- **Suggested topics:** PRD creation using brainstorming insights, technical architecture document, database schema design, Epic breakdown for phased development
- **Recommended timeframe:** Immediately - the brainstorming session has provided solid foundation for PRD creation
- **Preparation needed:** Review this brainstorming document, gather Supabase project details, confirm partner's input on mood transparency model

---

**Session Statistics:**

- **Total Techniques Used:** 7 (Strategic Questioning, Expert Analysis, Advanced Elicitation with First Principles + Devil's Advocate, Decision Matrix, Pre-mortem, Journey Mapping)
- **Total Ideas Generated:** 25+ strategic decisions and feature specifications
- **Key Decisions Made:** 8 (Architecture simplified, tech stack finalized, feature behaviors defined, risks identified)
- **Architecture Pivots:** 2 (PowerSync → TanStack Query, Zustand eliminated)
- **Session Duration:** ~90 minutes of strategic analysis

---

_Session facilitated using the BMAD CIS brainstorming framework_
