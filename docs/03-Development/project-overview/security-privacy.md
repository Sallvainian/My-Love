# Security & Privacy

## Authentication

- Supabase Auth with email/password
- JWT tokens with refresh rotation
- Row Level Security (RLS) on all database tables
- User-specific data isolation

## Data Storage

- Photos: Client-side IndexedDB (no cloud upload)
- Settings: LocalStorage (device-local)
- Mood/Interactions: Supabase with RLS (user-owned)
- Messages: IndexedDB (no cloud sync)

## Privacy Features

- No third-party analytics
- No advertising trackers
- Minimal cloud data (mood sync only)
- User controls what syncs
- Data export capability
