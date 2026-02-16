# 1. Database Schema Overview

The Supabase database uses PostgreSQL with Row Level Security (RLS) enabled on all tables. The schema covers two primary feature areas: the core couples app (users, moods, love notes, interactions, photos, partner requests) and the scripture reading feature (sessions, step states, reflections, bookmarks, messages).

## Supabase Tables

| Table | Description | RLS |
|---|---|---|
| `users` | User profiles linked to `auth.users`, partner relationships | Enabled |
| `moods` | Mood tracking entries with optional notes | Enabled |
| `love_notes` | Messages between partners with optional image attachments | Enabled |
| `interactions` | Quick interactions (poke, kiss) between partners | Enabled |
| `partner_requests` | Partnership invitation workflow | Enabled |
| `photos` | Photo gallery metadata (files stored in Supabase Storage) | Enabled |
| `scripture_sessions` | Scripture reading session state and progress | Enabled |
| `scripture_step_states` | Per-step lock/advance timestamps for sessions | Enabled |
| `scripture_reflections` | User reflections with ratings per reading step | Enabled |
| `scripture_bookmarks` | Bookmarked reading steps | Enabled |
| `scripture_messages` | Prayer report messages within a session | Enabled |

## Custom Enum Types

| Enum | Values |
|---|---|
| `scripture_session_mode` | `solo`, `together` |
| `scripture_session_phase` | `lobby`, `countdown`, `reading`, `reflection`, `report`, `complete` |
| `scripture_session_status` | `pending`, `in_progress`, `complete`, `abandoned` |

> **Note:** The original `mood_type`, `interaction_type`, and `partner_request_status` enums were dropped in migration `20251206024345` and replaced with TEXT columns plus CHECK constraints.

## Storage Buckets

| Bucket | Public | Size Limit | Purpose |
|---|---|---|---|
| `photos` | No | 10 MB | Photo gallery images |
| `love-notes-images` | No | Default | Love note image attachments |

---
