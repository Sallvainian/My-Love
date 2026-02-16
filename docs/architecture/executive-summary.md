# Executive Summary

## Overview

My-Love is a **Progressive Web Application (PWA)** designed for a couple to share love notes, track moods, upload photos, read scripture together, and celebrate relationship milestones. It is deployed as a monolithic Single-Page Application (SPA) on GitHub Pages with a Supabase backend.

## Core Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Application Type | PWA (installable, offline-capable) | Mobile-first, works without app store |
| Frontend Framework | React 19 + TypeScript 5.9 | Strict typing, modern React features |
| State Management | Zustand 5 with 10 slices | Lightweight, minimal boilerplate, persist middleware |
| Backend | Supabase (PostgreSQL + Auth + Storage + Realtime) | Managed BaaS, RLS security, real-time features |
| Local Storage | IndexedDB (via `idb`) + localStorage | Large data in IDB, small settings in localStorage |
| Styling | Tailwind CSS 4.1 + custom CSS layers | Utility-first, rapid UI development |
| Build Tool | Vite 7.3 with manual chunks | Fast dev server, optimized code splitting |
| Deployment | GitHub Pages via `gh-pages` | Free hosting, integrated with CI |
| Validation | Zod 4 schemas at service boundaries | Runtime safety for inputs and API responses |
| Animations | Framer Motion with LazyMotion | Tree-shakeable, reduced-motion support |

## Key Patterns

- **Feature-based structure**: Components organized by feature (MoodTracker, PhotoGallery, LoveNotes, ScriptureReading)
- **Slice composition**: Zustand store composed from 10 independent slices, each owning its domain state and actions
- **Dual storage**: Critical settings in localStorage (fast hydration), large data in IndexedDB (no quota limits)
- **Online-first with offline fallback**: Writes go to IndexedDB first, then sync to Supabase; Background Sync API handles deferred uploads
- **Lazy loading**: All secondary views (Photos, Mood, Partner, Notes, Scripture) are code-split via `React.lazy`
- **Validation layers**: Zod schemas validate both user input (local) and API responses (Supabase)
- **Optimistic UI**: Notes, interactions, and moods update the UI immediately, then confirm with the server

## Application Scope

The app is designed for **exactly 2 users** (a couple). Features include:

- **Home**: Relationship timer, birthday/event countdowns, daily love message rotation
- **Photos**: Shared photo gallery with upload, compression, carousel viewer
- **Mood**: Daily mood tracking with multi-mood selection, partner mood visibility, offline sync
- **Partner**: Poke/kiss interactions, partner mood viewing with Supabase Realtime
- **Love Notes**: Real-time chat between partners with image attachments
- **Scripture Reading**: Solo and together reading flow with reflections, bookmarks, and daily prayer reports

## Production Environment

- **URL**: `https://<username>.github.io/My-Love/`
- **Base path**: `/My-Love/` in production, `/` in development (configured in `vite.config.ts`)
- **Service Worker**: injectManifest strategy via VitePWA, custom `sw.ts`
- **Node requirement**: 24.13.0
- **Package manager**: npm (detected by `package-lock.json`)
