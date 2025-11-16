# Architecture Overview

## Pattern

**Component-based Single Page Application with Offline-First PWA Architecture**

## Layered Architecture

```
┌─────────────────────────────────────┐
│         UI Layer (React)            │
│    20 Components, 48 TSX Files      │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│       State Layer (Zustand)         │
│   7 Slices, 59 Actions, Persist     │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│      Service Layer (Business)       │
│   10 Services, Validation, Sync     │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│         API Layer (Supabase)        │
│    8 API Services, Real-time        │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│       Storage Layer (Hybrid)        │
│ IndexedDB │ LocalStorage │ Supabase │
└─────────────────────────────────────┘
```

## Data Flow

**Unidirectional**: User Action → Store Action → Service Layer → API/Storage → State Update → UI Re-render

## Persistence Strategy

| Data Type         | Storage Location        | Sync Strategy                     |
| ----------------- | ----------------------- | --------------------------------- |
| Photos            | IndexedDB               | Local-only (future: cloud backup) |
| Messages (custom) | IndexedDB               | Local-only                        |
| Mood Entries      | LocalStorage + Supabase | Real-time sync                    |
| User Settings     | LocalStorage            | Local-only                        |
| Interactions      | Supabase                | Real-time sync                    |
| Auth State        | Supabase Auth           | Cloud-managed                     |
