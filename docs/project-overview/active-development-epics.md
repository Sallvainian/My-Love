# Active Development Epics

## Planning Artifacts

The project uses the BMAD method for planning. All planning documents are in `_bmad-output/planning-artifacts/`.

- **Product Requirements Document**: `_bmad-output/planning-artifacts/prd/` -- Contains executive summary, success criteria, product scope, user journeys (6 defined), MVP constraints, web app requirements, phased development plan, functional requirements, non-functional requirements, and glossary.
- **Epic Breakdowns**: `_bmad-output/planning-artifacts/epics/` -- Epic list, per-epic story definitions with acceptance criteria, and requirements inventory with FR coverage map.
- **Sprint Status**: `_bmad-output/implementation-artifacts/sprint-status.yaml` -- Machine-readable status tracking for all epics, stories, and retrospective action items.

## Epic Status

| Epic | Name                                  | Status      | Stories | Branch                                    |
| ---- | ------------------------------------- | ----------- | ------- | ----------------------------------------- |
| 1    | Foundation and Solo Scripture Reading | Done        | 5/5     | merged to main                            |
| 2    | Reflection and Daily Prayer Report    | Done        | 3/3     | merged to main                            |
| 3    | Stats and Overview Dashboard          | Done        | 1/1     | merged to main                            |
| 4    | Together Mode -- Synchronized Reading | In Progress | 2/3     | `epic-4/together-mode-synchronized-reading` |

## Epic 1: Foundation and Solo Scripture Reading (Done)

Users can access Scripture Reading from bottom navigation, start a Solo session, read through all 17 scripture steps at their own pace, save and resume progress, and experience smooth optimistic UI. The feature is fully accessible with keyboard navigation, screen reader support, and reduced motion compliance.

**Stories (all done)**:

| Story | Name                                     | Status |
| ----- | ---------------------------------------- | ------ |
| 1.1   | Database Schema and Backend Infrastructure | Done   |
| 1.2   | Navigation and Overview Page              | Done   |
| 1.3   | Solo Reading Flow                         | Done   |
| 1.4   | Save, Resume, and Optimistic UI           | Done   |
| 1.5   | Accessibility Foundations                 | Done   |

**FRs covered**: FR1, FR1a, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR12, FR13, FR26, FR47-FR54

**Retrospective**: Done

## Epic 2: Reflection and Daily Prayer Report (Done)

Users can reflect on each scripture step with a rating, per-verse bookmark flag, and optional note. At the end of a session, users can send a message to their partner and view the Daily Prayer Report showing their own reflections and their partner's message.

**Stories (all done)**:

| Story | Name                              | Status |
| ----- | --------------------------------- | ------ |
| 2.1   | Per-Step Reflection System        | Done   |
| 2.2   | End-of-Session Reflection Summary | Done   |
| 2.3   | Daily Prayer Report Send and View | Done   |

**Retrospective**: Done

## Epic 3: Stats and Overview Dashboard (Done)

Users can view their Scripture Reading journey statistics on the overview page -- total sessions completed, total steps completed, average reflection rating, bookmark count, and last session date -- all as couple-aggregate metrics.

**Stories (all done)**:

| Story | Name                             | Status |
| ----- | -------------------------------- | ------ |
| 3.1   | Couple-Aggregate Stats Dashboard | Done   |

**Retrospective**: Done

## Epic 4: Together Mode -- Synchronized Reading (In Progress)

Couples can read scripture together in real-time with a lobby, Reader/Responder role selection, 3-second countdown, synchronized phase advancement via lock-in mechanism, partner position indicators, and graceful reconnection handling. Includes no-shame fallback to solo from lobby.

**Stories**:

| Story | Name                                    | Status      |
| ----- | --------------------------------------- | ----------- |
| 4.1   | Lobby, Role Selection, and Countdown    | Done        |
| 4.2   | Synchronized Reading with Lock-In       | Done        |
| 4.3   | Reconnection and Graceful Degradation   | In Progress |

**Retrospective**: Optional (epic not yet complete)

### Story 4.1: Lobby, Role Selection, and Countdown (Done)

Users can select Reader or Responder role, enter a lobby, ready up with their partner via Supabase Broadcast channel, and experience a synchronized 3-second countdown. Includes "Continue solo" fallback with no-shame messaging.

### Story 4.2: Synchronized Reading with Lock-In (Done)

Couples read verses with clear roles that alternate each step. Partners can freely navigate between verse and response screens with position indicators. Advancement requires mutual lock-in via the `scripture_lock_in` RPC with optimistic UI.

### Story 4.3: Reconnection and Graceful Degradation (In Progress)

Handles network interruptions during together-mode sessions with graceful fallback to solo mode, reconnection detection, and state recovery.

## Retrospective Action Items

All retrospective action items from Epics 1-3 have been completed:

| Action Item                            | Source  | Status |
| -------------------------------------- | ------- | ------ |
| Claude error handling rule             | Epic 1  | Done   |
| Claude container-store rule            | Epic 1  | Done   |
| Claude scope creep rule                | Epic 1  | Done   |
| Project context combined effects rule  | Epic 1  | Done   |
| ESLint recurring review patterns       | Epic 2  | Done   |
| Execute retro actions immediately      | Epic 2  | Done   |
| pgTAP couple relationship checklist    | Epic 3  | Done   |
| Architecture doc as exit criterion     | Epic 3  | Done   |
| Update structure boundaries doc        | Epic 3  | Done   |

## PRD User Journeys

The PRD defines 6 user journeys that drive feature requirements:

1. **Together Mode -- The Repair Ritual**: Both partners reading scripture together in real-time
2. **Solo Mode -- The Quiet Reset**: Individual reading at your own pace
3. **Reluctant Partner -- The Graceful Fallback**: When one partner does not want to participate
4. **Unlinked User -- The Solo-Only Path**: User without a linked partner
5. **Time-Constrained -- The Partial Session**: Save and resume when time runs out
6. **Reconnection -- The Dropped Connection**: Handling network interruptions during together mode
