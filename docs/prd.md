# My-Love - Product Requirements Document

**Author:** Frank
**Date:** 2025-11-16
**Version:** 1.0

---

## Executive Summary

My-Love Mobile is a native mobile app that brings the existing My-Love web experience to iOS and Android through React Native + Expo. Built for a couple who want to feel more connected throughout their day, this app transforms an already-functional web PWA into a native mobile experience that lives where you live - in your pocket, always a tap away.

The migration isn't about porting code - it's about reimagining the connection experience for mobile. With real-time Love Notes, instant push notifications, and the performance gains of native execution, partners stay emotionally synchronized throughout their day. The app leverages existing Supabase infrastructure for authentication and data while introducing TanStack Query for smart caching, delivering a simpler architecture that matches the always-connected reality of modern mobile usage.

### What Makes This Special

**Deeper connection through native mobile performance.** The app transforms daily rituals - morning mood logs, midday Love Notes, evening photo shares - from "when I get to my computer" into instant, in-pocket moments. Native performance means sub-second interactions: mood logged in under 5 seconds, Love Notes delivered in real-time with push notification heartbeat, photos shared instantly. It's not about more features - it's about the existing connection experience being *faster, more immediate, and always accessible*.

The full transparency model (both partners see everything) combined with real-time delivery creates genuine emotional synchronization. When she logs her mood, you know. When you send a Love Note, she gets it instantly. This isn't a social media app for broadcasting - it's an intimate space designed for exactly two people.

---

## Project Classification

**Technical Type:** mobile_app
**Domain:** general
**Complexity:** low

This is a React Native + Expo mobile app for personal relationship tracking between two partners. It operates in the general domain without regulatory complexity (no healthcare, fintech, or compliance requirements). The technical challenge lies in native mobile development patterns, Supabase real-time integration, and push notification reliability - not domain-specific regulations.

**Key Classification Factors:**
- Cross-platform mobile (iOS + Android) via React Native + Expo
- Online-first architecture with smart caching (not offline-first sync)
- Leverages existing Supabase backend infrastructure
- Two-user intimate scale (no multi-tenancy or scaling concerns)
- Personal/lifestyle app category for App Store submission

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

2. **Love Note Anticipation** - When a partner sends a Love Note, the recipient genuinely looks forward to the notification. The real-time delivery creates moments of connection throughout the day. Success: Love Notes are exchanged multiple times per day because it *feels good* to send and receive them.

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
- React Native + Expo project structure with TypeScript
- Expo Router file-based navigation
- TanStack Query integration with Supabase client
- Supabase authentication with deep linking (magic link flow)
- MMKV local storage for preferences and cached data

**Essential Features:**

1. **Love Notes (NEW)** - Real-time messaging between partners
   - Supabase Realtime subscription for instant delivery
   - Optimistic updates via TanStack Query
   - Push notification on new message received
   - Message history with scroll-back

2. **Push Notification Infrastructure** - The heartbeat of daily engagement
   - Daily love message notification (scheduled, 7 AM)
   - Love Note arrival alerts (real-time)
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

## Mobile App Specific Requirements

### Platform Support

**Target Platforms:**
- iOS 16.0+ (current mainstream target)
- Android 13+ (API level 33, current mainstream)
- Minimum support: iOS 15.0+ / Android 10+ (API 29) for broader compatibility

**Development Approach:**
- React Native + Expo managed workflow
- Single codebase for both platforms
- EAS Build for production builds
- EAS Submit for App Store and Google Play submissions

**Deployment:**
- TestFlight for iOS beta testing
- Internal testing track for Android beta
- Production release to both stores simultaneously

### Device Permissions & Features

**Required Permissions:**

1. **Push Notifications** - Core to the app's value proposition
   - Request on first launch with clear value explanation
   - Graceful degradation if denied (in-app notification history)
   - Re-prompt strategy if initially denied

2. **Photo Library Access** - For photo gallery uploads
   - "Add Photos Only" permission preferred (write-only)
   - Full library access if needed for image selection
   - NOT camera access (uploads from existing photos, not camera capture)

3. **Network/Internet** - Online-first architecture
   - Required for all core functionality
   - TanStack Query caching provides temporary offline resilience

**Optional Features:**

4. **Haptic Feedback** - Tactile responses for key interactions
   - Love Note sent confirmation (subtle success haptic)
   - Love Note received (notification haptic)
   - Mood logged (soft confirmation haptic)
   - Partner poke/kiss sent (playful haptic)

5. **Biometric Authentication** - Optional unlock method
   - Face ID (iOS) / Fingerprint (Android) as alternative to magic link
   - NOT replacing Supabase auth, just device-level convenience
   - User can enable/disable in settings
   - Falls back to magic link if biometric fails

### Offline Mode Strategy

**Online-First Architecture** (NOT offline-first sync):

- **Primary Pattern:** All operations require network connectivity
- **Caching Layer:** TanStack Query caches server responses
  - Stale-while-revalidate for improved perceived performance
  - Automatic background refetch when app regains focus
  - Optimistic updates for immediate UI feedback
- **Graceful Degradation:** If network unavailable:
  - Show cached data (marked as potentially stale)
  - Queue outgoing actions? NO - fail immediately with retry prompt
  - User expectation: "I need internet for this app"
- **Rationale:** User confirmed "I expect to really never be offline" in brainstorming

**No PowerSync/Offline-First Sync:** Intentionally avoided to reduce complexity

### Push Notification Strategy

**Notification Types:**

1. **Daily Love Message** (Scheduled)
   - Trigger: Supabase Edge Function cron job at 7:00 AM user's timezone
   - Content: Today's message from 365-rotation
   - Action: Tap opens app to message display screen
   - Priority: High (should wake device)

2. **Love Note Received** (Real-time)
   - Trigger: Supabase Realtime subscription detects new message
   - Content: "[Partner name]: [message preview]"
   - Action: Tap opens Love Notes conversation
   - Priority: High (time-sensitive communication)

3. **Mood Reminder** (Scheduled, Optional)
   - Trigger: User-configurable time, Supabase Edge Function
   - Content: "How are you feeling today?"
   - Action: Tap opens mood tracker
   - Priority: Default (can be postponed)
   - User can disable entirely

4. **Milestone/Anniversary** (Scheduled)
   - Trigger: Supabase Edge Function on special dates
   - Content: "Today marks X days together!"
   - Action: Tap opens anniversary countdown
   - Priority: Default

**Technical Implementation:**
- Expo Notifications for unified API across iOS/Android
- EAS Push Service for delivery
- Supabase Edge Functions for server-side scheduling
- Push token stored in Supabase user profile
- Foreground notification handling (show in-app banner)
- Background notification handling (system notification)

**Pre-mortem Risk Mitigation:**
- Test on physical devices in production builds (not Expo Go)
- Handle iOS background restrictions (background app refresh)
- Handle Android battery optimization (Doze mode)
- In-app notification history as fallback

### App Store Compliance

**Apple App Store Requirements:**

1. **Privacy Policy** - Required before submission
   - Document all data collection (moods, photos, messages, push tokens)
   - Explain Supabase storage and encryption
   - No third-party data sharing (personal use app)
   - Must be hosted at accessible URL

2. **App Store Privacy Labels** - Complete all questionnaires
   - Data Types: Contact Info, Health & Fitness (mood), Photos, Messages
   - Data Linked to You: Yes (user accounts)
   - Tracking: None

3. **App Store Connect Metadata**
   - App name, description, keywords
   - Screenshots for all device sizes
   - Age rating: 4+ (no objectionable content)
   - Category: Lifestyle or Social Networking

4. **TestFlight Beta Testing**
   - Internal testing before public submission
   - Both partners test on actual devices
   - Validate auth deep linking works in production build
   - Test all notification types

**Google Play Store Requirements:**

1. **Privacy Policy** - Same as iOS
2. **Data Safety Section** - Similar to Apple privacy labels
3. **Play Console Setup** - App listing, screenshots, descriptions
4. **Content Rating** - IARC questionnaire (Everyone/All ages expected)
5. **Internal Testing Track** - Beta testing before production

**Pre-mortem Risk: App Store Rejection**
- Mitigation: Draft comprehensive privacy policy covering all data usage
- Mitigation: Complete all privacy questionnaires accurately
- Mitigation: Test deeply with TestFlight before production submission
- Mitigation: Ensure deep linking auth flow works in production builds

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
- Persistence of preference via MMKV

**Overall Aesthetic:**
- Clean and minimal (not cluttered)
- Soft animations with Framer Motion patterns (from web PWA)
- Lucide icons for consistency with web version
- Professional enough for daily use, personal enough for intimacy

### Key Interaction Patterns

**1. Notification Deep Linking:**
- Tap notification → land directly in relevant context
- Love Note notification → opens chat at that message
- Daily message notification → opens message display
- Mood reminder → opens mood tracker input
- No intermediate screens, no friction

**2. Quick Mood Logging (< 5 seconds):**
- Open app OR tap mood reminder notification
- See emoji grid (12 emotions from web PWA)
- Single tap to select mood
- Optional: add brief note
- Haptic confirmation on save
- Done. Back to life.

**3. Love Notes Chat:**
- Simple conversational interface
- Text input at bottom, messages scroll above
- Partner messages on left, yours on right
- Timestamp on each message
- Optimistic send (appears immediately, syncs in background)
- Haptic feedback on send
- Real-time updates when partner sends

**4. Photo Sharing:**
- Pick from library (single or multi-select)
- See compression/upload progress indicator
- Thumbnail preview before confirm
- Gallery view shows both partners' photos
- Tap to view full screen with swipe navigation

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

- **FR1:** Users can authenticate via Supabase magic link (email-based passwordless login)
- **FR2:** Users maintain authenticated sessions across app launches
- **FR3:** Users can log out and re-authenticate as needed
- **FR4:** App handles authentication deep linking for magic link redirects
- **FR5:** Users can optionally enable biometric authentication (Face ID/fingerprint) for convenience unlock
- **FR6:** System stores push notification tokens in user profile for notification delivery

### Love Notes (Real-Time Messaging)

- **FR7:** Users can send text messages to their partner through Love Notes
- **FR8:** Users receive partner's Love Notes in real-time via Supabase Realtime subscription
- **FR9:** System delivers push notification when new Love Note arrives
- **FR10:** Users can view complete Love Notes message history with scroll-back
- **FR11:** Love Notes display sender identification and timestamp on each message
- **FR12:** System provides optimistic update (message appears immediately before server confirmation)
- **FR13:** System provides haptic feedback on Love Note send and receive

### Push Notification Infrastructure

- **FR14:** System sends daily love message notification at 7:00 AM user's timezone
- **FR15:** System sends push notification immediately when partner sends Love Note
- **FR16:** Users can configure optional mood reminder notifications at custom time
- **FR17:** System sends milestone/anniversary notifications on special dates
- **FR18:** Users can tap notifications to deep link directly to relevant screen
- **FR19:** App displays in-app notification history as fallback if push fails
- **FR20:** System requests notification permission on first launch with clear value explanation
- **FR21:** App handles notifications in both foreground (in-app banner) and background (system notification) states

### Mood Tracking

- **FR22:** Users can log current mood by selecting from 12 emotion options
- **FR23:** Users can optionally add brief text note with mood entry
- **FR24:** Users can view their partner's mood entries (full transparency model)
- **FR25:** Users can view mood history timeline showing entries over time
- **FR26:** Mood logging completes in under 5 seconds (quick access priority)
- **FR27:** System provides haptic feedback on mood save confirmation
- **FR28:** System syncs mood entries to Supabase for partner visibility

### Photo Gallery

- **FR29:** Users can select photos from device library for upload
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
- **FR43:** System provides playful haptic feedback on poke/kiss send
- **FR44:** Users can view history of partner interactions

### Anniversary & Milestones

- **FR45:** App displays days together countdown from relationship start date
- **FR46:** System calculates and shows upcoming milestones (100 days, 1 year, etc.)
- **FR47:** System sends push notifications on milestone dates

### Settings & Preferences

- **FR48:** Users can toggle between light mode and dark mode
- **FR49:** System detects device theme preference as default
- **FR50:** Theme preference persists across app launches via MMKV storage
- **FR51:** Users can enable/disable mood reminder notifications
- **FR52:** Users can configure mood reminder notification time
- **FR53:** Users can enable/disable biometric authentication
- **FR54:** Users can view and manage their profile information

### Dashboard & Overview

- **FR55:** Dashboard displays partner's current/latest mood prominently
- **FR56:** Dashboard shows preview of last Love Note received
- **FR57:** Dashboard displays days together counter
- **FR58:** Dashboard shows snippet of today's daily love message
- **FR59:** Dashboard provides quick access navigation to all major features

### Technical Platform Requirements

- **FR60:** App runs on iOS 16.0+ (target) with iOS 15.0+ minimum support
- **FR61:** App runs on Android 13+ (target) with Android 10+ minimum support
- **FR62:** App persists user preferences locally via MMKV storage
- **FR63:** App caches server responses via TanStack Query for performance
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

Performance is critical because the primary user excitement is "being more connected through native mobile performance." The app must feel instant - not web-in-a-wrapper, but genuinely native.

**NFR-P1: App Launch Time**
- Cold start to interactive screen: < 2 seconds on target devices
- Warm start (backgrounded): < 500ms to interactive
- Rationale: Native apps should launch faster than web alternatives
- Measurement: Profile with Flipper/React Native debugger on physical devices

**NFR-P2: Screen Transition Performance**
- Navigation between screens: < 300ms transition animation
- No dropped frames during transitions (60fps maintained)
- Rationale: Janky transitions destroy native perception
- Measurement: React Native Performance Monitor, frame rate profiling

**NFR-P3: Love Notes Real-Time Latency**
- Message sent to notification received: < 2 seconds under normal conditions
- Message appears in chat: < 500ms after Supabase Realtime event
- Rationale: Real-time messaging is core value proposition
- Measurement: End-to-end latency tests with Supabase Realtime

**NFR-P4: Mood Logging Speed**
- From tap to saved confirmation: < 5 seconds total interaction
- UI response to emoji tap: < 100ms visual feedback
- Save operation: < 1 second server roundtrip
- Rationale: Quick logging is key interaction pattern
- Measurement: User timing with stopwatch, network profiling

**NFR-P5: Image Upload Performance**
- Compression: < 3 seconds for typical phone photo
- Upload progress visible and accurate
- Total time to uploaded and visible: < 10 seconds for standard photo
- Rationale: Photo sharing shouldn't feel slow or block interaction
- Measurement: Upload timing tests on various image sizes

**NFR-P6: Memory Usage**
- App memory footprint: < 150MB under normal use
- No memory leaks during extended sessions
- Image gallery virtualized (only visible images loaded)
- Rationale: Prevent app crashes and phone slowdown
- Measurement: Memory profiling via Xcode Instruments / Android Profiler

**NFR-P7: TanStack Query Caching**
- Cache hit for recent data: < 50ms response
- Stale data shown immediately while revalidating in background
- Optimistic updates reflected in UI immediately
- Rationale: Cached data provides instant perceived performance
- Measurement: Network tab, cache effectiveness metrics

### Security Requirements

Security matters because the app handles intimate personal data (moods, photos, private messages) between two partners. Data protection is essential for trust.

**NFR-S1: Authentication Security**
- Supabase magic link tokens expire after 60 minutes
- Session tokens stored securely in device keychain (not plain storage)
- Biometric auth uses OS-level secure enclave
- No passwords stored on device
- Rationale: Personal data requires proper authentication protection
- Validation: Security audit of auth flow, token storage inspection

**NFR-S2: Data in Transit Encryption**
- All Supabase API calls over HTTPS (TLS 1.3)
- WebSocket connections encrypted for Realtime subscriptions
- Push notification payloads don't contain sensitive message content (ID references only)
- Rationale: Prevent interception of intimate communications
- Validation: Network traffic analysis, certificate pinning verification

**NFR-S3: Data at Rest Protection**
- Supabase enforces Row Level Security (RLS) policies
- Only authenticated user and their partner can access shared data
- Photos stored in Supabase Storage with access policies
- Local preferences (MMKV) stored in app sandbox
- Rationale: Data must be protected from unauthorized access
- Validation: RLS policy testing, storage permissions audit

**NFR-S4: Push Token Security**
- Push tokens stored only in user's Supabase profile
- Tokens not exposed through any API responses
- Token refresh handled automatically by Expo
- Rationale: Push tokens could be abused for spam if exposed
- Validation: API response inspection, token storage verification

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

**NFR-I3: Expo Notifications Compatibility**
- Compatible with Expo SDK version used in project
- EAS Push Service token registration
- Handle notification permission denial gracefully
- Support iOS and Android notification APIs
- Rationale: Push notifications are primary engagement mechanism
- Validation: Notification delivery tests on both platforms

**NFR-I4: TanStack Query Integration**
- Version compatibility with React Native
- Proper Supabase query key management
- Cache invalidation on mutations
- Background refetch on app focus
- Rationale: TanStack Query manages all server state
- Validation: Query lifecycle tests, cache consistency checks

**NFR-I5: Deep Linking Support**
- Expo Linking handles authentication magic links
- Notification deep links route to correct screens
- Handle invalid deep link URLs gracefully
- Rationale: Magic link auth and notification routing depend on deep links
- Validation: Deep link routing tests for all notification types

**NFR-I6: Platform-Specific APIs**
- Haptic feedback uses platform-appropriate APIs (Taptic Engine iOS, Vibration API Android)
- Biometrics use platform secure enclaves
- Photo library access follows platform permission models
- Rationale: Native feel requires platform-appropriate implementations
- Validation: Platform-specific feature tests on physical devices

### Reliability Requirements

**NFR-R1: Crash Tolerance**
- App crash rate: < 1% of sessions
- No data loss on app crash (unsent messages queued for retry)
- Graceful error recovery (no permanent stuck states)
- Rationale: Crashes destroy user trust in the app
- Measurement: Crash reporting via Sentry or similar

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

1. **Push Notification Focus** - The app's core value proposition centers on notifications being emotionally anticipated, not just technically delivered. Success is measured by partners *looking forward* to notifications.

2. **Love Notes Real-Time Messaging** - New feature not present in web PWA. Supabase Realtime + optimistic updates + push notifications create instant partner connection.

3. **Online-First Simplicity** - Intentionally avoids offline-first sync complexity (no PowerSync). TanStack Query provides smart caching without the overhead of conflict resolution.

4. **"Love" Theme Visual Identity** - Warm romantic palette with dark mode support creates intimate, personal feel that differentiates from generic apps.

5. **Two-User Intimate Scale** - No multi-tenancy, no scaling concerns, no enterprise features. Every design decision optimized for exactly two partners.

6. **Native Performance Priority** - Sub-second interactions: < 2s launch, < 5s mood logging, < 2s message delivery. Native feel is non-negotiable.

7. **Haptic Feedback Language** - Tactile responses on key actions (send, receive, log) create satisfying feedback that reinforces emotional connection.

### Known Risks & Assumptions

**Technical Risks:**

1. **Push Notification Reliability** (HIGH PRIORITY)
   - Risk: iOS background restrictions and Android battery optimization may delay notifications
   - Assumption: In-app notification history provides acceptable fallback
   - Mitigation: Test on physical devices in production builds, handle platform-specific background modes

2. **Deep Linking Auth Flow** (MEDIUM PRIORITY)
   - Risk: Magic link deep linking may not work in production builds (TestFlight/production) vs development
   - Assumption: Expo Linking handles this correctly with proper configuration
   - Mitigation: Test auth flow in TestFlight builds early, document configuration precisely

3. **Supabase Realtime Stability** (MEDIUM PRIORITY)
   - Risk: WebSocket connections may drop on network changes or app backgrounding
   - Assumption: TanStack Query caching provides acceptable UX during brief disconnections
   - Mitigation: Implement robust reconnection logic, subscription recovery

**App Store Risks:**

4. **Privacy Policy Completeness** (HIGH PRIORITY)
   - Risk: Incomplete privacy disclosures could delay App Store submission
   - Assumption: Personal use app with no third-party data sharing simplifies compliance
   - Mitigation: Draft comprehensive privacy policy before submission

5. **Data Classification (Mood as "Health")** (LOW PRIORITY)
   - Risk: Apple may classify mood tracking as health data requiring special handling
   - Assumption: Mood is personal preference, not medical health data
   - Mitigation: Review Apple's health data guidelines, adjust privacy labels if needed

**Assumptions Made:**

- User expects to always have network connectivity (online-first is acceptable)
- Partners trust each other completely (full transparency model is desired)
- 7:00 AM is appropriate default for daily message notification
- 365-message rotation algorithm from web PWA works without modification
- Existing Supabase schema can accommodate Love Notes table addition
- Both partners will test via TestFlight before production submission
- Photo library access (not camera) is sufficient for photo uploads
- 12 emotion options from web PWA are comprehensive enough

### Recommended Next Workflow

**🎨 UX Design Workflow** → **Then** Architecture Workflow

**Rationale:**

1. **Visual Identity is Core** - The "Love" theme with warm romantic colors and dark mode support needs visual design before architecture can determine component structure.

2. **Interaction Patterns Need Wireframes** - Quick mood logging (< 5 seconds), Love Notes chat interface, and notification deep linking flows need UX specification.

3. **Mobile-First UX** - Native mobile gestures, tap targets, and screen layouts differ significantly from web PWA patterns.

4. **Component Inventory Unclear** - Architecture needs to know what screens exist, their layouts, and interaction flows before planning technical structure.

**After UX Design:**

- Architecture workflow will take UX screens/flows and determine React Native component hierarchy, navigation structure, state management patterns, and Supabase schema modifications.

**Alternative Path:**

If Frank prefers to dive into technical architecture first (familiar with React Native patterns), the Architecture workflow could proceed directly using this PRD + brainstorming session results. The UX design could then validate/refine the architecture's UI assumptions.

---

## Document Metadata

**PRD Created:** 2025-11-16
**Author:** Frank (with AI assistance)
**Version:** 1.0
**Status:** Complete - Ready for downstream workflows

**Input Sources:**
- Brainstorming Session Results (2025-11-16)
- My-Love PWA Brownfield Documentation
- User clarifications during PRD workflow

**Output Handoff:**
- 65 Functional Requirements → UX Design (screens, interactions)
- 18 Non-Functional Requirements → Architecture (performance, security, integration)
- Success Criteria → Validation framework for MVP
- Product Scope → Epic breakdown foundation
- Mobile Requirements → Platform-specific implementation guidance

---

**End of Product Requirements Document**

