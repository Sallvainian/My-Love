# Authentication Flow

```
1. App mounts
   |
   +-> authService.getSession()
   |     |
   |     +-> [session exists] -> check display_name
   |     |     |
   |     |     +-> [has display_name] -> initializeApp() -> Main App
   |     |     +-> [no display_name] -> DisplayNameSetup form
   |     |
   |     +-> [no session] -> LoginScreen
   |           |
   |           +-> email/password login
   |           +-> authService.onAuthStateChange() fires
   |           +-> session established -> re-check display_name
   |
2. Auth state listener runs for entire app lifetime
   |
   +-> onAuthStateChange(session)
         +-> [session] check user_metadata.display_name
         +-> [no session] show LoginScreen
```

Supabase handles session persistence, auto-refresh of JWT tokens, and OAuth callback detection. The `sw-auth` IndexedDB store caches the access token for Service Worker Background Sync access.

---
