# My-Love - Product Requirements Document

**Author:** Frank
**Date:** 2025-11-16
**Version:** 1.0

---

## Executive Summary

My-Love is a Progressive Web App (PWA) that enhances and stabilizes the existing relationship tracking platform. Built for a couple who want to feel more connected throughout their day, this project focuses on fixing existing bugs, repairing deployment infrastructure, and enhancing the codebase with better quality patterns - all while preserving the solid foundation already in place.

The enhancement isn't about rewriting everything - it's about systematically improving what already works. With real-time Love Notes via Supabase Realtime, Web Push notifications for instant alerts, and the modern React 19 + Vite stack already in place, partners stay emotionally synchronized throughout their day. The app leverages existing Supabase infrastructure with Zustand for client state management, delivering a maintainable architecture optimized for web performance.

### What Makes This Special

**Deeper connection through web-first reliability.** The PWA transforms daily rituals - morning mood logs, midday Love Notes, evening photo shares - into accessible moments from any device with a browser. Web performance means fast interactions: mood logged in under 5 seconds, Love Notes delivered in real-time with Web Push notification heartbeat, photos shared with progress feedback. It's not about adding complexity - it's about the existing connection experience being _stable, maintainable, and consistently reliable_.

The full transparency model (both partners see everything) combined with real-time delivery creates genuine emotional synchronization. When she logs her mood, you know. When you send a Love Note, she gets it instantly. This isn't a social media app for broadcasting - it's an intimate space designed for exactly two people.

---

## Project Classification

**Technical Type:** pwa_enhancement
**Domain:** general
**Complexity:** low

This is a Progressive Web App (PWA) enhancement project for personal relationship tracking between two partners. It operates in the general domain without regulatory complexity (no healthcare, fintech, or compliance requirements). The technical focus is on bug fixes, deployment repair, and code quality improvements - not architectural overhauls.

**Key Classification Factors:**

- Progressive Web App with React 19 + Vite 7 + TypeScript
- Online-first architecture with Zustand state management
- Leverages existing Supabase backend infrastructure
- Two-user intimate scale (no multi-tenancy or scaling concerns)
- Web deployment via GitHub Pages or similar static hosting

---

## Reference Documents

**Product Brief Path:** None (brainstorming session provides strategic foundation)

**Domain Brief Path:** None (general domain, no specialized research required)

**Research Documents:**

- Brainstorming Session Results (2025-11-16) - Architecture decisions, tech stack finalization, risk analysis
- My-Love PWA Documentation (comprehensive brownfield codebase analysis)
- Existing Supabase integration patterns from Epic 6 retrospective

---

## Success Criteria

**Primary Success Indicator:** Push notifications become something both partners look forward to receiving.

This isn't about notification volume or technical delivery rates - it's about emotional anticipation. When Frank's phone buzzes with a My-Love notification, the reaction should be warmth and curiosity ("What did she send?"), not annoyance or dismissal. The app succeeds when notifications feel like love notes in your pocket, not digital noise.

**What This Success Looks Like in Practice:**

1. **Morning Daily Message Ritual** - The 7 AM notification becomes a welcomed start to the day. Both partners anticipate it, and it sets a positive emotional tone. Success: neither partner disables or mutes these notifications.

2. **Love Note Anticipation** - When a partner sends a Love Note, the recipient genuinely looks forward to the notification. The real-time delivery creates moments of connection throughout the day. Success: Love Notes are exchanged multiple times per day because it _feels good_ to send and receive them.

3. **Notification Reliability Breeds Trust** - Notifications arrive consistently and promptly. No "I sent it but you didn't get it" frustrations. Success: both partners trust the app enough to rely on it for their connection rituals.

4. **No Notification Fatigue** - The app doesn't over-notify. Each notification is meaningful (daily message, Love Note from partner, mood update). Success: notifications remain enabled and unmodified after 30+ days of usage.

5. **Mobile-First Becomes Natural** - Interactions that used to require opening the web app now happen instantly via notification tap. Success: the web PWA becomes secondary; mobile is the primary touchpoint.

**Measurable Proxies:**

- Both partners keep push notifications enabled after 30 days
- Love Notes sent/received ratio approaches 1:1 (reciprocal engagement)
- Average response time to Love Note notifications under 5 minutes during waking hours
- Daily message opened within 30 minutes of delivery
- Zero incidents of "I didn't get your notification" after initial setup

---

## Product Scope

### MVP - Minimum Viable Product

The MVP delivers a complete native mobile experience that replicates and enhances the web PWA's core connection features, with Love Notes as the flagship new capability.

**Core Foundation:**

- React 19 + Vite 7 with TypeScript strict mode
- React Router or file-based routing solution
- Zustand for client state management + Supabase client
- Supabase authentication with email/password and Google OAuth
- IndexedDB/localStorage for preferences and cached data (idb package)

**Essential Features:**

1. **Love Notes (NEW)** - Real-time messaging between partners
   - Supabase Realtime subscription for instant delivery
   - Optimistic updates via Zustand state management
   - Web Push notification on new message received
   - Message history with scroll-back

2. **Web Push Notification Infrastructure** - The heartbeat of daily engagement
   - Daily love message notification (scheduled, 7 AM via service worker)
   - Love Note arrival alerts (real-time via Web Push API)
   - Mood reminder notifications (optional, configurable)
   - Milestone/anniversary reminders
   - In-app notification history as backup

3. **Mood Tracker** - Full transparency model
   - Log current mood with emotion selection (12 options from web app)
   - View partner's mood entries
   - Mood history timeline
   - Quick access (< 5 seconds to log)

4. **Photo Gallery** - Bi-directional shared gallery
   - Upload photos to Supabase Storage
   - View partner's uploaded photos
   - Image compression before upload
   - Gallery view with thumbnails

5. **Migrated Web Features:**
   - Anniversary countdown display
   - Daily message display (365-message rotation)
   - Partner poke/kiss interactions
   - Profile and settings management
   - Dashboard view with partner status

### Growth Features (Post-MVP)

Enhancements that deepen engagement and reduce friction after core experience is validated.

1. **Home Screen Widget** - Mood logging in < 3 taps from lock screen
2. **Custom Notification Tones** - Personalized sounds for different notification types
3. **Read Receipts** - Visual confirmation when partner has seen Love Note
4. **Heart Reactions** - Quick emoji responses to Love Notes (beyond full reply)
5. **Dashboard Summary View** - At-a-glance partner status without scrolling
6. **Notification When Partner Logs Mood** - Real-time awareness of partner activity

### Vision (Future)

Ambitious capabilities that transform the app from utility to relationship companion.

1. **Voice Notes** - Audio messages in Love Notes for richer communication
2. **Relationship Analytics Dashboard** - Patterns and trends from mood/chat data over time
3. **AI-Generated Love Messages** - Personalized daily messages based on relationship patterns
4. **Shared Calendar Integration** - Important dates, anniversaries, milestones in one view
5. **Timeline View** - Chronological journey through shared memories (photos, moods, notes)
6. **Collaborative Memory Books** - Export shared content into digital scrapbooks

---

## PWA Specific Requirements

### Platform Support

**Target Platforms:**

- Modern browsers: Chrome 90+, Firefox 90+, Safari 15+, Edge 90+
- Desktop and mobile web browsers
- PWA installable on supported platforms (Chrome, Edge, Safari iOS)

**Development Approach:**

- React 19 + Vite 7 + TypeScript
- Single codebase for all platforms
- vite-plugin-pwa for service worker and manifest generation
- Workbox for caching strategies

**Deployment:**

- GitHub Pages for static hosting
- Automated deployment via GitHub Actions
- Preview deployments for testing

### Browser Permissions & Features

**Required Permissions:**

1. **Web Push Notifications** - Core to the app's value proposition
   - Request on user interaction with clear value explanation
   - Graceful degradation if denied (in-app notification history)
   - Browser-specific permission flows

2. **File System Access** - For photo gallery uploads
   - HTML5 File API for image selection
   - Camera access via getUserMedia (optional)
   - Drag-and-drop support for desktop users

3. **Network/Internet** - Online-first architecture
   - Required for all core functionality
   - Service worker caching provides temporary offline resilience

**Optional Features:**

4. **Vibration API** - Tactile responses for key interactions (mobile)
   - Love Note sent confirmation
   - Love Note received notification
   - Mood logged confirmation
   - Partner poke/kiss sent

5. **Web Authentication API** - Optional convenience unlock
   - Passkey/biometric authentication support
   - NOT replacing Supabase auth, just device-level convenience
   - Falls back to email/password if not available

### Offline Mode Strategy

**Online-First Architecture** (NOT offline-first sync):

- **Primary Pattern:** All operations require network connectivity
- **Caching Layer:** Service worker caches static assets and API responses
  - Stale-while-revalidate for improved perceived performance
  - Automatic background refetch on reconnection
  - Zustand state management with optimistic updates
- **Graceful Degradation:** If network unavailable:
  - Show cached data (marked as potentially stale)
  - Queue outgoing actions? NO - fail immediately with retry prompt
  - User expectation: "I need internet for this app"
- **Rationale:** User confirmed "I expect to really never be offline" in brainstorming

**No Complex Offline Sync:** Intentionally avoided to reduce complexity

### Web Push Notification Strategy

**Notification Types:**

1. **Daily Love Message** (Scheduled)
   - Trigger: Supabase Edge Function cron job at 7:00 AM user's timezone
   - Content: Today's message from 365-rotation
   - Action: Click opens app to message display screen
   - Priority: High

2. **Love Note Received** (Real-time)
   - Trigger: Supabase Realtime subscription + Web Push API
   - Content: "[Partner name]: [message preview]"
   - Action: Click opens Love Notes conversation
   - Priority: High (time-sensitive communication)

3. **Mood Reminder** (Scheduled, Optional)
   - Trigger: User-configurable time, Supabase Edge Function
   - Content: "How are you feeling today?"
   - Action: Click opens mood tracker
   - Priority: Default
   - User can disable entirely

4. **Milestone/Anniversary** (Scheduled)
   - Trigger: Supabase Edge Function on special dates
   - Content: "Today marks X days together!"
   - Action: Click opens anniversary countdown
   - Priority: Default

**Technical Implementation:**

- Web Push API with VAPID keys
- Service Worker for background notification handling
- Supabase Edge Functions for server-side scheduling
- Push subscription stored in Supabase user profile
- Notification API for displaying alerts
- Badge API for unread counts (where supported)

**Pre-mortem Risk Mitigation:**

- Test across different browsers (Chrome, Firefox, Safari)
- Handle Safari iOS limitations (requires PWA installation for push)
- Handle browser notification permission policies
- In-app notification history as fallback

### PWA Compliance & Installability

**PWA Manifest Requirements:**

1. **Web App Manifest** - Required for installability
   - name, short_name, description
   - Icons at multiple sizes (192x192, 512x512)
   - start_url and scope
   - display: standalone
   - theme_color and background_color
   - Categories: lifestyle, social

2. **Service Worker** - Required for PWA features
   - Cache static assets (HTML, CSS, JS, images)
   - Handle fetch events for API caching
   - Background sync (where supported)
   - Push notification event handling

3. **HTTPS** - Required for PWA features
   - All production deployments over HTTPS
   - Service worker registration requires secure context
   - Web Push requires secure context

4. **Performance Standards**
   - Lighthouse PWA score > 90
   - First Contentful Paint < 2s
   - Time to Interactive < 3s
   - Core Web Vitals compliance

**Pre-mortem Risk: Browser Compatibility**

- Mitigation: Test across major browsers regularly
- Mitigation: Graceful degradation for unsupported features
- Mitigation: Feature detection before using advanced APIs
- Mitigation: Clear messaging when features unavailable

---

## User Experience Principles

### Visual Personality

**"Love" Theme:**

- Warm, romantic color palette (soft pinks, reds, warm neutrals)
- Intimate and personal feel (not clinical or corporate)
- Gentle rounded corners and soft shadows
- Heart iconography where appropriate (not overdone)
- Typography that feels warm yet readable

**Dark Mode Support:**

- Toggle in settings for user preference
- System preference detection as default
- Dark theme maintains "Love" warmth (warm grays, not cold blacks)
- All UI elements tested for contrast in both modes
- Persistence of preference via localStorage/IndexedDB

**Overall Aesthetic:**

- Clean and minimal (not cluttered)
- Soft animations with Framer Motion patterns (from web PWA)
- Lucide icons for consistency with web version
- Professional enough for daily use, personal enough for intimacy

### Key Interaction Patterns

**1. Notification Deep Linking:**

- Click notification → land directly in relevant context
- Love Note notification → opens chat at that message
- Daily message notification → opens message display
- Mood reminder → opens mood tracker input
- No intermediate screens, no friction

**2. Quick Mood Logging (< 5 seconds):**

- Open app OR click mood reminder notification
- See emoji grid (12 emotions from web PWA)
- Single click to select mood
- Optional: add brief note
- Visual/vibration confirmation on save
- Done. Back to life.

**3. Love Notes Chat:**

- Simple conversational interface
- Text input at bottom, messages scroll above
- Partner messages on left, yours on right
- Timestamp on each message
- Optimistic send (appears immediately, syncs in background)
- Visual feedback on send (vibration on mobile)
- Real-time updates when partner sends

**4. Photo Sharing:**

- Pick from file system or drag-and-drop (single or multi-select)
- See compression/upload progress indicator
- Thumbnail preview before confirm
- Gallery view shows both partners' photos
- Click to view full screen with navigation controls

**5. Dashboard Quick Glance:**

- Partner's current mood prominently displayed
- Last Love Note preview
- Days together counter
- Today's daily message snippet
- Quick access to all features

### Emotional Design Goals

The UI should reinforce the core value proposition: **feeling connected**.

- **Trust through reliability:** When you send, it arrives. When something happens, you see it immediately.
- **Warmth through visual design:** The "Love" theme makes every interaction feel personal, not transactional.
- **Intimacy through simplicity:** Two-person focus means no noise, no distractions, just you and your partner.
- **Joy through feedback:** Haptics, subtle animations, and visual confirmations make actions feel satisfying.

---

## Functional Requirements

This section defines WHAT capabilities the product must have. Each FR is a testable capability that downstream workflows (UX Design, Architecture, Epic Breakdown) will implement.

### User Account & Authentication

- **FR1:** Users can authenticate via Supabase (email/password or Google OAuth)
- **FR2:** Users maintain authenticated sessions across app launches
- **FR3:** Users can log out and re-authenticate as needed
- **FR4:** App handles authentication redirect URLs for OAuth flow
- **FR5:** Users can optionally enable Web Authentication API (passkeys/biometrics) for convenience unlock
- **FR6:** System stores Web Push subscription in user profile for notification delivery

### Love Notes (Real-Time Messaging)

- **FR7:** Users can send text messages to their partner through Love Notes
- **FR8:** Users receive partner's Love Notes in real-time via Supabase Realtime subscription
- **FR9:** System delivers push notification when new Love Note arrives
- **FR10:** Users can view complete Love Notes message history with scroll-back
- **FR11:** Love Notes display sender identification and timestamp on each message
- **FR12:** System provides optimistic update (message appears immediately before server confirmation)
- **FR13:** System provides visual/vibration feedback on Love Note send and receive

### Push Notification Infrastructure

- **FR14:** System sends daily love message notification at 7:00 AM user's timezone
- **FR15:** System sends push notification immediately when partner sends Love Note
- **FR16:** Users can configure optional mood reminder notifications at custom time
- **FR17:** System sends milestone/anniversary notifications on special dates
- **FR18:** Users can click notifications to navigate directly to relevant screen
- **FR19:** App displays in-app notification history as fallback if push fails
- **FR20:** System requests notification permission on user interaction with clear value explanation
- **FR21:** App handles Web Push notifications via service worker

### Mood Tracking

- **FR22:** Users can log current mood by selecting from 12 emotion options
- **FR23:** Users can optionally add brief text note with mood entry
- **FR24:** Users can view their partner's mood entries (full transparency model)
- **FR25:** Users can view mood history timeline showing entries over time
- **FR26:** Mood logging completes in under 5 seconds (quick access priority)
- **FR27:** System provides visual/vibration feedback on mood save confirmation
- **FR28:** System syncs mood entries to Supabase for partner visibility

### Photo Gallery

- **FR29:** Users can select photos from file system or drag-and-drop for upload
- **FR30:** System compresses images before uploading to Supabase Storage
- **FR31:** Users see upload progress indicator during photo upload
- **FR32:** Users can view shared gallery showing both partners' photos
- **FR33:** Gallery displays thumbnails for efficient browsing
- **FR34:** Users can tap photo to view full-screen with swipe navigation
- **FR35:** System syncs uploaded photos to Supabase for partner visibility

### Daily Love Messages

- **FR36:** System displays today's love message from 365-message rotation library
- **FR37:** System determines which message to display based on deterministic rotation algorithm
- **FR38:** Users receive push notification with daily message preview at scheduled time
- **FR39:** Users can tap daily message notification to view full message in app

### Partner Interactions

- **FR40:** Users can send partner poke interaction
- **FR41:** Users can send partner kiss interaction
- **FR42:** System notifies partner when poke/kiss is received
- **FR43:** System provides playful visual/vibration feedback on poke/kiss send
- **FR44:** Users can view history of partner interactions

### Anniversary & Milestones

- **FR45:** App displays days together countdown from relationship start date
- **FR46:** System calculates and shows upcoming milestones (100 days, 1 year, etc.)
- **FR47:** System sends push notifications on milestone dates

### Settings & Preferences

- **FR48:** Users can toggle between light mode and dark mode
- **FR49:** System detects device theme preference as default
- **FR50:** Theme preference persists across sessions via localStorage/IndexedDB
- **FR51:** Users can enable/disable mood reminder notifications
- **FR52:** Users can configure mood reminder notification time
- **FR53:** Users can enable/disable Web Authentication (passkeys/biometrics)
- **FR54:** Users can view and manage their profile information

### Dashboard & Overview

- **FR55:** Dashboard displays partner's current/latest mood prominently
- **FR56:** Dashboard shows preview of last Love Note received
- **FR57:** Dashboard displays days together counter
- **FR58:** Dashboard shows snippet of today's daily love message
- **FR59:** Dashboard provides quick access navigation to all major features

### Technical Platform Requirements

- **FR60:** App runs on modern browsers: Chrome 90+, Firefox 90+, Safari 15+, Edge 90+
- **FR61:** App supports PWA installation on compatible browsers and platforms
- **FR62:** App persists user preferences locally via localStorage/IndexedDB
- **FR63:** App caches static assets and API responses via service worker for performance
- **FR64:** App provides visual indication when network is unavailable
- **FR65:** System stores all user data in Supabase with proper Row Level Security

---

**FR Count: 65 functional requirements**

**Self-Validation Check:**

- ✅ All MVP features covered (Love Notes, Notifications, Moods, Photos, Migrations)
- ✅ Mobile-specific requirements included (deep linking, haptics, biometrics, permissions)
- ✅ UX patterns captured (quick mood logging, notification deep linking, dashboard)
- ✅ Each FR is testable capability
- ✅ Each FR states WHAT not HOW
- ✅ Organized by capability area, not technology layer

---

## Non-Functional Requirements

Non-functional requirements define HOW the system performs rather than WHAT it does. For this mobile app, the focus areas are performance (critical for native feel), security (personal relationship data), and integration (Supabase ecosystem).

### Performance Requirements

Performance is critical because the primary user excitement is "being more connected through web-first reliability." The app must feel responsive - fast page loads, smooth interactions, and consistent behavior across browsers.

**NFR-P1: Page Load Time**

- Initial page load to interactive: < 2 seconds on typical connections
- Subsequent navigation (cached): < 500ms to interactive
- Rationale: Fast web apps compete with native alternatives
- Measurement: Lighthouse performance metrics, Core Web Vitals

**NFR-P2: Client-Side Navigation Performance**

- Navigation between views: < 300ms transition animation
- No jank during transitions (60fps maintained)
- Rationale: Smooth transitions improve perceived quality
- Measurement: Browser DevTools Performance panel, frame rate profiling

**NFR-P3: Love Notes Real-Time Latency**

- Message sent to notification received: < 2 seconds under normal conditions
- Message appears in chat: < 500ms after Supabase Realtime event
- Rationale: Real-time messaging is core value proposition
- Measurement: End-to-end latency tests with Supabase Realtime

**NFR-P4: Mood Logging Speed**

- From click to saved confirmation: < 5 seconds total interaction
- UI response to emoji click: < 100ms visual feedback
- Save operation: < 1 second server roundtrip
- Rationale: Quick logging is key interaction pattern
- Measurement: User timing with stopwatch, network profiling

**NFR-P5: Image Upload Performance**

- Compression: < 3 seconds for typical photo
- Upload progress visible and accurate
- Total time to uploaded and visible: < 10 seconds for standard photo
- Rationale: Photo sharing shouldn't feel slow or block interaction
- Measurement: Upload timing tests on various image sizes

**NFR-P6: Memory Usage**

- Tab memory footprint: < 150MB under normal use
- No memory leaks during extended sessions
- Image gallery virtualized (only visible images loaded)
- Rationale: Prevent browser tab crashes and slowdown
- Measurement: Browser DevTools Memory panel, heap snapshots

**NFR-P7: Service Worker Caching**

- Cache hit for static assets: < 50ms response
- Stale data shown immediately while revalidating in background
- Optimistic updates reflected in UI immediately
- Rationale: Cached data provides instant perceived performance
- Measurement: Network tab, service worker cache effectiveness

### Security Requirements

Security matters because the app handles intimate personal data (moods, photos, private messages) between two partners. Data protection is essential for trust.

**NFR-S1: Authentication Security**

- Supabase session tokens refresh automatically
- Session tokens stored securely in browser storage (HttpOnly cookies where possible)
- Web Authentication API uses platform secure enclave when available
- No passwords stored in browser
- Rationale: Personal data requires proper authentication protection
- Validation: Security audit of auth flow, token storage inspection

**NFR-S2: Data in Transit Encryption**

- All Supabase API calls over HTTPS (TLS 1.3)
- WebSocket connections encrypted for Realtime subscriptions
- Push notification payloads don't contain sensitive message content (ID references only)
- Rationale: Prevent interception of intimate communications
- Validation: Network traffic analysis, HTTPS enforcement verification

**NFR-S3: Data at Rest Protection**

- Supabase enforces Row Level Security (RLS) policies
- Only authenticated user and their partner can access shared data
- Photos stored in Supabase Storage with access policies
- Local preferences (localStorage/IndexedDB) stored in browser origin
- Rationale: Data must be protected from unauthorized access
- Validation: RLS policy testing, storage permissions audit

**NFR-S4: Push Subscription Security**

- Push subscriptions stored only in user's Supabase profile
- Subscriptions not exposed through any API responses
- Subscription refresh handled automatically by service worker
- Rationale: Push subscriptions could be abused for spam if exposed
- Validation: API response inspection, subscription storage verification

**NFR-S5: Input Validation**

- Love Notes: Max 1000 characters, XSS sanitization
- Mood notes: Max 200 characters
- Profile fields: Type validation and length limits
- Photo uploads: File type verification, size limits (10MB max)
- Rationale: Prevent injection attacks and data corruption
- Validation: Input fuzzing tests, boundary testing

**NFR-S6: Session Management**

- Session timeout after 30 days of inactivity
- User can manually log out from settings
- Session revoked server-side on logout
- Device-specific sessions (logging out on one device doesn't affect others)
- Rationale: Long sessions for convenience, with manual control
- Validation: Session lifecycle testing, logout verification

### Integration Requirements

Integration requirements focus on the Supabase ecosystem and third-party services that the app depends on for core functionality.

**NFR-I1: Supabase Client Compatibility**

- Compatible with Supabase JS Client v2.x
- Support for Supabase Auth, Database, Realtime, Storage
- Handle Supabase service degradation gracefully (show cached data, retry logic)
- Rationale: Supabase is the entire backend infrastructure
- Validation: Integration tests against Supabase APIs, error handling tests

**NFR-I2: Supabase Realtime Reliability**

- WebSocket reconnection on network change
- Subscription recovery after app backgrounds
- Handle Realtime service unavailability (fallback to polling or cached data)
- Rationale: Love Notes real-time delivery is core feature
- Validation: Network disruption tests, background/foreground cycling

**NFR-I3: Web Push API Compatibility**

- VAPID keys configuration for push subscriptions
- Service worker handles push events
- Handle notification permission denial gracefully
- Support across major browsers (Chrome, Firefox, Safari)
- Rationale: Push notifications are primary engagement mechanism
- Validation: Notification delivery tests across browsers

**NFR-I4: Zustand State Management Integration**

- Version compatibility with React 19
- Proper state slice organization
- Optimistic updates on mutations
- Persistence via localStorage/IndexedDB
- Rationale: Zustand manages client state efficiently
- Validation: State lifecycle tests, persistence checks

**NFR-I5: URL Routing Support**

- React Router or similar handles navigation
- Authentication redirects route correctly
- Handle invalid URLs gracefully with 404 fallback
- Rationale: OAuth redirects and notification clicks depend on URL routing
- Validation: Route handling tests for all navigation scenarios

**NFR-I6: Browser-Specific APIs**

- Vibration API for tactile feedback (mobile browsers)
- Web Authentication API for passkey support
- File API for photo upload handling
- Rationale: Modern web APIs provide native-like experiences
- Validation: Feature detection and browser compatibility tests

### Reliability Requirements

**NFR-R1: Error Tolerance**

- JavaScript error rate: < 1% of sessions
- No data loss on errors (unsent messages queued for retry)
- Graceful error recovery (no permanent stuck states)
- Rationale: Errors destroy user trust in the app
- Measurement: Error reporting via console monitoring or Sentry

**NFR-R2: Error Handling**

- User-friendly error messages (not technical jargon)
- Network errors show retry options
- Validation errors prevent data corruption
- All errors logged for debugging (not sent to third parties)
- Rationale: Errors are inevitable; handling determines user experience
- Validation: Error scenario testing, message clarity review

**NFR-R3: Offline Resilience (Graceful Degradation)**

- Show cached data clearly marked as potentially stale
- Fail operations immediately with retry prompt (no offline queue)
- App remains navigable when offline (view cached content)
- Rationale: Online-first architecture, but shouldn't crash when offline
- Validation: Airplane mode testing, network disruption scenarios

---

**NFR Count: 18 non-functional requirements across 4 categories**

**Category Breakdown:**

- Performance: 7 NFRs (P1-P7)
- Security: 6 NFRs (S1-S6)
- Integration: 6 NFRs (I1-I6)
- Reliability: 3 NFRs (R1-R3)

**Skipped Categories:**

- ❌ Scale/Capacity: N/A - 2-user intimate app, no growth concerns
- ❌ Accessibility/Compliance: N/A - Personal app for specific users, standard platform accessibility sufficient

---

## PRD Summary & Next Steps

### Total Requirements

**83 Total Requirements:**

- 65 Functional Requirements (WHAT the system does)
- 18 Non-Functional Requirements (HOW the system performs)

**Coverage by Feature:**

- User Account & Authentication: 6 FRs
- Love Notes (Real-Time Messaging): 7 FRs
- Push Notification Infrastructure: 8 FRs
- Mood Tracking: 7 FRs
- Photo Gallery: 7 FRs
- Daily Love Messages: 4 FRs
- Partner Interactions: 5 FRs
- Anniversary & Milestones: 3 FRs
- Settings & Preferences: 7 FRs
- Dashboard & Overview: 5 FRs
- Technical Platform: 6 FRs
- Performance: 7 NFRs
- Security: 6 NFRs
- Integration: 6 NFRs
- Reliability: 3 NFRs

### Key Differentiators

1. **Web Push Notification Focus** - The app's core value proposition centers on notifications being emotionally anticipated, not just technically delivered. Success is measured by partners _looking forward_ to notifications.

2. **Love Notes Real-Time Messaging** - New feature enhancing the PWA. Supabase Realtime + optimistic updates + Web Push notifications create instant partner connection.

3. **Online-First Simplicity** - Intentionally avoids offline-first sync complexity. Service worker caching provides smart caching without the overhead of conflict resolution.

4. **"Love" Theme Visual Identity** - Warm romantic palette with dark mode support creates intimate, personal feel that differentiates from generic apps.

5. **Two-User Intimate Scale** - No multi-tenancy, no scaling concerns, no enterprise features. Every design decision optimized for exactly two partners.

6. **Web Performance Priority** - Sub-second interactions: < 2s page load, < 5s mood logging, < 2s message delivery. Responsive web feel is non-negotiable.

7. **Modern Web APIs** - Vibration API, Web Push, Web Authentication API, and File API provide native-like experiences in the browser.

### Known Risks & Assumptions

**Technical Risks:**

1. **Web Push Notification Reliability** (HIGH PRIORITY)
   - Risk: Safari iOS requires PWA installation for push, browser notification policies vary
   - Assumption: In-app notification history provides acceptable fallback
   - Mitigation: Test across browsers, document PWA installation requirements for iOS

2. **Browser Compatibility** (MEDIUM PRIORITY)
   - Risk: Features may work differently across Chrome, Firefox, Safari
   - Assumption: Feature detection handles graceful degradation
   - Mitigation: Test across major browsers, use polyfills where needed

3. **Supabase Realtime Stability** (MEDIUM PRIORITY)
   - Risk: WebSocket connections may drop on network changes or tab backgrounding
   - Assumption: Service worker caching provides acceptable UX during brief disconnections
   - Mitigation: Implement robust reconnection logic, subscription recovery

**Deployment Risks:**

4. **GitHub Pages Limitations** (MEDIUM PRIORITY)
   - Risk: Static hosting limitations for advanced routing or server-side features
   - Assumption: Client-side routing with hash history or proper 404 fallback works
   - Mitigation: Configure deployment for SPA routing, test thoroughly

5. **Service Worker Updates** (LOW PRIORITY)
   - Risk: Users may have stale cached versions of the app
   - Assumption: Workbox update prompts handle this gracefully
   - Mitigation: Implement clear update notification flow

**Assumptions Made:**

- User expects to always have network connectivity (online-first is acceptable)
- Partners trust each other completely (full transparency model is desired)
- 7:00 AM is appropriate default for daily message notification
- 365-message rotation algorithm works without modification
- Existing Supabase schema can accommodate Love Notes table addition
- Both partners will test on staging before production deployment
- File system access (not camera) is sufficient for photo uploads
- 12 emotion options are comprehensive enough

### Recommended Next Workflow

**🔍 PWA Audit** → **🛠️ Bug Fixes** → **🚀 Deployment Repair**

**Rationale:**

1. **Understand Current State** - Before enhancing, systematically audit existing bugs, broken features, and deployment issues.

2. **Fix Foundation First** - Stabilize the existing PWA before adding new features like Love Notes.

3. **Deployment is Critical** - Broken deployment pipeline blocks all progress; must be repaired immediately.

4. **Code Quality Baseline** - Assess existing patterns and technical debt before introducing new code.

**After Stabilization:**

- Architecture document can be updated to reflect actual PWA stack (React 19, Vite, Zustand)
- Epic breakdown can focus on PWA enhancements rather than mobile migration
- New features (Love Notes, improved backend) built on stable foundation

**Alternative Path:**

If Frank prefers to rewrite Architecture and Epics first (documentation-driven approach), that work can proceed in parallel with initial bug triage. However, stabilizing the deployment pipeline should be highest priority regardless of approach.

---

## Document Metadata

**PRD Created:** 2025-11-16
**PRD Updated:** 2025-11-17 (Platform pivot: Native Mobile → PWA Enhancement)
**Author:** Frank (with AI assistance)
**Version:** 2.0
**Status:** Complete - Ready for PWA stabilization workflows

**Input Sources:**

- Original PRD (2025-11-16)
- My-Love PWA Brownfield Documentation
- Platform pivot decision (2025-11-17)
- Existing PWA codebase analysis (React 19, Vite, Zustand, Tailwind)

**Output Handoff:**

- 65 Functional Requirements → Bug audit, feature implementation
- 18 Non-Functional Requirements → Architecture (performance, security, integration)
- Success Criteria → Validation framework for PWA enhancement
- Product Scope → Epic breakdown foundation
- PWA Requirements → Browser-specific implementation guidance

---

**End of Product Requirements Document**
