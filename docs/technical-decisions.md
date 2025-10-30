# Technical Decisions Log

**Project:** My-Love
**Created:** 2025-10-30
**Last Updated:** 2025-10-30

---

## Purpose

This document tracks technical decisions, constraints, preferences, and considerations discovered during product planning and development.

---

## Decisions & Constraints

### Technical Debt Assessment Required

**Context:** v0.1.0 was rapidly prototyped ("vibe-coded") to validate core concept
**Decision:** Include technical debt scan and refactoring in Epic 1
**Rationale:** Before adding new features, assess and address any code quality issues, architectural inconsistencies, or technical shortcuts from rapid prototyping
**Impact:** Ensures stable foundation for feature development
**Date:** 2025-10-30

### Backend Architecture for Mood Sync & Interactive Features

**Context:** Mood tracking and poke/kiss features require data sharing between two users
**Decision:** Implement lightweight backend using NocoDB (free tier) with API integration
**Alternatives Considered:**
- Supabase/Firebase (more complex than needed)
- Google Sheets API (rate limits and auth complexity)
- Full custom backend (overkill for simple sync)
**Rationale:** NocoDB provides free hosting, simple REST API, and minimal setup while maintaining privacy. Keeps 95% of app client-side, only syncs minimal interactive data.
**Impact:** Adds backend dependency but enables key relationship features
**Date:** 2025-10-30

### Client-Side Architecture Maintained

**Context:** Persistence issues in v0.1.0 raised question about architecture
**Decision:** Maintain client-side first architecture (IndexedDB + LocalStorage)
**Rationale:** Aligns with privacy goals, offline-first approach, and zero-cost hosting. Persistence bug is fixable via Zustand persist configuration, not an architectural flaw.
**Impact:** No backend needed for photos, messages, or personal data
**Date:** 2025-10-30

---

## Future Decisions

_Technical decisions will be appended here as they arise during planning and development_
