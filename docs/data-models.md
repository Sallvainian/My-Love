# Data Models

> Database schema and TypeScript types for My-Love project.

## Database Schema

### Overview

| Table | Description | RLS |
|-------|-------------|-----|
| `users` | User profiles | Yes |
| `moods` | Mood entries | Yes |
| `interactions` | Poke/kiss/fart records | Yes |
| `love_notes` | Chat messages | Yes |
| `photos` | Photo metadata | Yes |
| `partner_requests` | Partner connection flow | Yes |

### users

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT,
  display_name TEXT,
  partner_id UUID REFERENCES users(id),
  partner_name TEXT,
  device_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Auth user ID |
| `email` | TEXT | User email |
| `display_name` | TEXT | Display name |
| `partner_id` | UUID | Linked partner |
| `partner_name` | TEXT | Partner's name |
| `device_id` | TEXT | Device identifier |

### moods

```sql
CREATE TABLE moods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  mood_type TEXT NOT NULL,
  mood_types TEXT[],
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Mood entry ID |
| `user_id` | UUID | Owner user |
| `mood_type` | TEXT | Primary mood emoji |
| `mood_types` | TEXT[] | Multiple moods |
| `note` | TEXT | Optional note |

### interactions

```sql
CREATE TABLE interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES users(id),
  to_user_id UUID NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  viewed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

| Column | Type | Description |
|--------|------|-------------|
| `type` | TEXT | 'poke', 'kiss', 'fart' |
| `viewed` | BOOLEAN | Read status |

### love_notes

```sql
CREATE TABLE love_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL,
  to_user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### photos

```sql
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT DEFAULT 'image/jpeg',
  file_size INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### partner_requests

```sql
CREATE TABLE partner_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES users(id),
  to_user_id UUID NOT NULL REFERENCES users(id),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

## TypeScript Types

### Database Types (`src/types/database.types.ts`)

Auto-generated from Supabase schema:

```typescript
export type Database = {
  public: {
    Tables: {
      users: { Row: {...}, Insert: {...}, Update: {...} },
      moods: { Row: {...}, Insert: {...}, Update: {...} },
      interactions: { Row: {...}, Insert: {...}, Update: {...} },
      love_notes: { Row: {...}, Insert: {...}, Update: {...} },
      photos: { Row: {...}, Insert: {...}, Update: {...} },
      partner_requests: { Row: {...}, Insert: {...}, Update: {...} },
    },
    Functions: {
      accept_partner_request: {...},
      decline_partner_request: {...},
    }
  }
}
```

### Application Models (`src/types/models.ts`)

```typescript
// Love Note
interface LoveNote {
  id: string;
  from_user_id: string;
  to_user_id: string;
  content: string;
  created_at: string;
  image_url?: string | null;
  // Client-side optimistic fields
  sending?: boolean;
  error?: boolean;
  tempId?: string;
}

// Love Notes State
interface LoveNotesState {
  notes: LoveNote[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
}

// Send Message Input
interface SendMessageInput {
  content: string;
  timestamp: string;
  imageFile?: File;
}
```

### Photo Types

```typescript
// From photoService
interface SupabasePhoto {
  id: string;
  user_id: string;
  storage_path: string;
  filename: string;
  mime_type: string;
  file_size: number;
  width: number;
  height: number;
  caption: string | null;
  created_at: string;
}

interface PhotoWithUrls extends SupabasePhoto {
  url: string;          // Signed URL
  thumbnailUrl: string; // Thumbnail URL
}

interface StorageQuota {
  used: number;
  limit: number;
  percentage: number;
}
```

## Zod Schemas

### Mood Schema

```typescript
const SupabaseMoodSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  mood_type: z.string(),
  mood_types: z.array(z.string()).nullable(),
  note: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});

type SupabaseMood = z.infer<typeof SupabaseMoodSchema>;
```

### User Schema

```typescript
const SupabaseUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().nullable(),
  display_name: z.string().nullable(),
  partner_id: z.string().uuid().nullable(),
  partner_name: z.string().nullable(),
  device_id: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});
```

## Database Functions

### accept_partner_request

```sql
CREATE FUNCTION accept_partner_request(p_request_id UUID)
RETURNS void AS $$
BEGIN
  -- Update request status
  -- Link users as partners
  -- Cleanup pending requests
END;
$$ LANGUAGE plpgsql;
```

### decline_partner_request

```sql
CREATE FUNCTION decline_partner_request(p_request_id UUID)
RETURNS void AS $$
BEGIN
  -- Update request status to 'declined'
END;
$$ LANGUAGE plpgsql;
```

## Row Level Security

All tables have RLS policies ensuring:
- Users can only read/write their own data
- Partner data accessible via `partner_id` relationship
- No cross-user data access

Example policy:

```sql
CREATE POLICY "Users can view own moods"
  ON moods FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view partner moods"
  ON moods FOR SELECT
  USING (
    user_id IN (
      SELECT partner_id FROM users WHERE id = auth.uid()
    )
  );
```
