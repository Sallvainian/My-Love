# API Layer Architecture

## Supabase Integration Points

```
src/api/
├── supabaseClient.ts          # SDK initialization
│   └── Creates singleton client with env vars
│
├── authService.ts             # Authentication
│   ├── signIn(email, password)
│   ├── signUp(email, password)
│   ├── signOut()
│   └── getCurrentUser()
│
├── partnerService.ts          # Partner management
│   ├── createPairingCode()
│   ├── joinPartner(code)
│   └── getPartnerInfo()
│
├── moodApi.ts                 # Mood CRUD
│   ├── saveMoodEntry(entry)
│   ├── getMoodHistory(userId, range)
│   └── deleteMoodEntry(id)
│
├── moodSyncService.ts         # Real-time sync
│   ├── subscribeToPartnerMood(partnerId)
│   └── broadcastMoodChange(entry)
│
├── interactionService.ts      # Poke/Kiss
│   ├── sendInteraction(type, partnerId)
│   ├── getInteractionHistory()
│   └── markAsRead(id)
│
└── errorHandlers.ts           # Centralized errors
    ├── handleSupabaseError(error)
    └── retryWithBackoff(fn, attempts)
```
