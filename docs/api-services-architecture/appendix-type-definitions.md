# Appendix: Type Definitions

## Core Entity Types

```typescript
// User (from Supabase auth)
interface User {
  id: string; // UUID
  email: string;
  user_metadata?: Record<string, any>;
}

// Session (JWT tokens)
interface Session {
  user: User;
  access_token: string; // JWT access token
  refresh_token: string; // Refresh token
  expires_in: number; // Seconds until expiry
}

// Mood Entry (local)
interface MoodEntry {
  id?: number;
  userId: string; // Supabase UUID
  mood: string; // Primary mood
  moods: string[]; // All selected moods
  note: string;
  date: string; // YYYY-MM-DD
  timestamp: Date;
  synced: boolean;
  supabaseId?: string;
}

// Photo (local)
interface Photo {
  id?: number;
  imageBlob: Blob;
  caption?: string;
  tags?: string[];
  uploadDate: Date;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
}

// Message (local)
interface Message {
  id?: number;
  text: string;
  category: 'reason' | 'memory' | 'affirmation' | 'future' | 'custom';
  isCustom: boolean;
  active: boolean;
  isFavorite: boolean;
  createdAt: Date;
  updatedAt?: Date;
  tags?: string[];
}
```

---
