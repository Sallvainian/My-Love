# Active Development Epics

## Planning Artifacts

The project uses the BMAD method for planning. All planning documents are in `_bmad-output/planning-artifacts/`.

- **Product Requirements Document**: `_bmad-output/planning-artifacts/prd/` -- Contains executive summary, success criteria, product scope, user journeys (6 defined), MVP constraints, web app requirements, phased development plan, functional requirements, non-functional requirements, and glossary.
- **Epic Breakdowns**: `_bmad-output/planning-artifacts/epics/` -- Epic list, per-epic story definitions with acceptance criteria, and requirements inventory with FR coverage map.

## Epic Status

| Epic | Name | Status | Branch |
|---|---|---|---|
| 1 | Foundation and Solo Scripture Reading | Complete | merged to main |
| 2 | Reflection and Daily Prayer Report | In Progress | `codex/finish-epic-2-development` |
| 3 | Stats and Overview Dashboard | Planned | -- |
| 4 | Together Mode -- Synchronized Reading | Planned | -- |

## Epic 1: Foundation and Solo Scripture Reading (Complete)

Users can access Scripture Reading from bottom navigation, start a Solo session, read through all 17 scripture steps at their own pace, save and resume progress, and experience smooth optimistic UI. The feature is fully accessible with keyboard navigation, screen reader support, and reduced motion compliance.

**Stories**:
- Story 1.1: Database Schema and Backend Infrastructure
- Story 1.2: Navigation and Overview Page
- Story 1.3: Solo Reading Flow
- Story 1.4: Save, Resume, and Optimistic UI
- Story 1.5: Accessibility Foundations

**FRs covered**: FR1, FR1a, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR12, FR13, FR26, FR47-FR54

## Epic 2: Reflection and Daily Prayer Report (In Progress)

**Stories**:
- Story 2.1: Per-Step Reflection System -- Rating (1-5) and optional notes after each verse, inline reflection screen
- Story 2.2: End-of-Session Reflection Summary -- Standout verse selection, session rating, bookmark sharing toggle
- Story 2.3: Daily Prayer Report -- Send and View -- Report generation, partner delivery, view received reports

## Epic 3: Stats and Overview Dashboard (Planned)

- Story 3.1: Couple-Aggregate Stats Dashboard

## Epic 4: Together Mode -- Synchronized Reading (Planned)

- Story 4.1: Lobby, Role Selection, and Countdown
- Story 4.2: Synchronized Reading with Lock-In
- Story 4.3: Reconnection and Graceful Degradation

## PRD User Journeys

The PRD defines 6 user journeys that drive feature requirements:

1. **Together Mode -- The Repair Ritual**: Both partners reading scripture together in real-time
2. **Solo Mode -- The Quiet Reset**: Individual reading at your own pace
3. **Reluctant Partner -- The Graceful Fallback**: When one partner does not want to participate
4. **Unlinked User -- The Solo-Only Path**: User without a linked partner
5. **Time-Constrained -- The Partial Session**: Save and resume when time runs out
6. **Reconnection -- The Dropped Connection**: Handling network interruptions during together mode
