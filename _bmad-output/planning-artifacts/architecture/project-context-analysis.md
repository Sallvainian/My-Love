# Project Context Analysis

## Requirements Overview

**Functional Requirements:**
54 FRs organized into 8 capability areas:

| Category | FR Count | Architectural Impact |
|----------|----------|---------------------|
| Session Management | FR1-7 | Session lifecycle, mode selection, completion tracking |
| Solo Mode Flow | FR8-13 | Optimistic UI with caching, save/resume, self-paced progression |
| Together Mode Flow | FR14-29 | Real-time sync, lobby, roles, lock-in, reconnection |
| Reflection System | FR30-33 | Per-step data capture, bookmark flag |
| Daily Prayer Report | FR34-41 | End-of-session messaging, reflection comparison |
| Stats & Progress | FR42-46 | Aggregate queries, couple-level metrics |
| Partner Integration | FR47-49 | Partner detection, linking flow integration |
| Accessibility | FR50-54 | Keyboard nav, screen reader, reduced motion, color independence |

**Non-Functional Requirements:**
24 NFRs across 5 quality dimensions:

| Category | Key Targets | Architectural Driver |
|----------|-------------|---------------------|
| Performance | <500ms sync, <200ms transitions | Supabase Broadcast, optimistic UI |
| Security & Privacy | User + partner only access | RLS policies, private-by-default reflections |
| Reliability | 100% recovery, zero race conditions | Server-authoritative state, idempotent writes |
| Accessibility | WCAG AA, prefers-reduced-motion | Animation system, focus management |
| Integration | Existing Zustand/Supabase/IndexedDB patterns | Brownfield constraints |

**Scale & Complexity:**

- Primary domain: Full-stack PWA (client-heavy)
- Complexity level: Medium-High
- Estimated new architectural components: ~15 (5 tables, 1 slice, 8 UI components, sync service)

## Technical Constraints & Dependencies

**Brownfield Constraints (Must Follow):**
- Zustand slice composition pattern (new `scriptureReadingSlice`)
- Supabase Broadcast for real-time (not postgres_changes due to RLS)
- IndexedDB caching with optimistic UI (server is source of truth)
- Service layer architecture (new `scriptureReadingService`)
- Zod validation on all API responses
- No Server Components (pure client-side SPA)

**Technology Stack (Locked):**
- React 19 + TypeScript 5.9 + Vite 7.3
- Zustand 5.0 + idb 8.0 + Zod 4.3
- Supabase JS 2.90 (Auth, Database, Storage, Realtime)
- Tailwind CSS 4.1 + Framer Motion 12.27

**Integration Points:**
- `BottomNavigation` — Add 'scripture' to ViewType
- `authService` — User authentication and partner detection
- Existing RLS patterns — Extend for new tables
- Existing sync patterns — Extend for scripture reading data

## Cross-Cutting Concerns Identified

| Concern | Components Affected | Architectural Approach |
|---------|--------------------|-----------------------|
| **Real-time sync** | Lobby, reading phases, lock-in | Supabase Broadcast channel per session |
| **Caching & Optimistic UI** | Solo mode, reflections | IndexedDB read cache + write-through to server |
| **Session state machine** | All phases | Zustand slice + server-authoritative state |
| **Accessibility** | All UI components | Focus management, aria-live, reduced motion |
| **Partner data isolation** | All data access | RLS policies + broadcast authorization |
| **Reconnection handling** | Together mode | Server state resync, graceful degradation |
