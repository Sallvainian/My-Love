# Executive Summary

My Love is a Progressive Web App for couples, built as a single-page application with an offline-first architecture. The app provides daily love messages, mood tracking, photo sharing, real-time messaging (Love Notes), partner interactions (poke/kiss/fart), and a guided scripture reading experience. It targets exactly two authenticated users (a couple) and enforces data isolation through Supabase Row Level Security.

The system is designed around a dual-persistence model: Supabase (PostgreSQL) serves as the remote source of truth, while IndexedDB provides local offline storage. A service worker with Background Sync API support ensures data reaches the server even when the app is closed.

---
