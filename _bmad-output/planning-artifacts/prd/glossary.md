# Glossary

| Term | Definition |
|------|------------|
| **Solo mode** | Single-user session where one partner completes the Scripture Reading independently, resumable with optimistic UI. |
| **Together mode** | Synchronized two-user session where both partners progress through steps in real-time, online-required. |
| **Reader** | The partner role who reads the scripture verse aloud during Together mode. |
| **Responder** | The partner role who reads the response prayer during Together mode. |
| **Lobby** | The waiting room where partners join and ready-up before a Together mode session begins. |
| **Phase** | A distinct stage within each step: Verse (Reader reads), Response (Responder reads), Reflection (both submit). |
| **Reflection** | The user's response after each step: a 1-5 rating, optional help flag, and optional note. |
| **Help flag** / **Sensitive flag** | A toggle indicating "I want my partner's help" or "I'm sensitive to this" — signals vulnerability without requiring explanation. |
| **Daily Prayer Report** | End-of-session summary showing both partners' step-by-step reflections and optional messages to each other. |
| **Server-authoritative state** | Design pattern where the server is the single source of truth for session state, preventing race conditions and ensuring consistency during reconnections. |
| **Broadcast channel** | Supabase Realtime feature used to synchronize Together mode events between partners in real-time. |
| **Optimistic UI** | Architecture pattern where user actions appear instant (stored in IndexedDB cache) while syncing to server in background. Server is source of truth; IndexedDB provides fast reads and graceful offline viewing. |
