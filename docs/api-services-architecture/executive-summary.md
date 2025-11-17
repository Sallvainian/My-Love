# Executive Summary

The My-Love application implements a sophisticated **offline-first, cloud-synchronous architecture** with:

- **Supabase Backend**: PostgreSQL database with Row Level Security (RLS), real-time subscriptions, and authentication
- **API Layer**: Validated service wrapper around Supabase using Zod schemas for type safety
- **Service Layer**: IndexedDB-based local storage with inherited CRUD patterns from `BaseIndexedDBService`
- **Sync Strategy**: Local-first with background sync to cloud, exponential backoff retry logic
- **Authentication**: Email/password and Google OAuth support with JWT session management

**Key Architecture Decisions**:

- Zod validation on all API responses (runtime type safety)
- Singleton pattern for all services to ensure single instance across app
- Abstract base class (`BaseIndexedDBService`) to eliminate ~80% code duplication
- Graceful degradation on network errors (read operations fail silently, write operations throw)
- Concurrent initialization guards to prevent race conditions

---
