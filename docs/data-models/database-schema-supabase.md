# Database Schema (Supabase)

## Profiles Table

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  display_name TEXT NOT NULL,
  partner_id UUID REFERENCES profiles(id),
  pairing_code TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
```

## Mood Entries Table

```sql
CREATE TABLE mood_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  moods TEXT[] NOT NULL,          -- Array of mood types
  intensity INTEGER CHECK (intensity BETWEEN 1 AND 5),
  note TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_moods CHECK (
    moods <@ ARRAY['happy', 'content', 'excited', 'loved', 'grateful',
                   'peaceful', 'sad', 'anxious', 'frustrated', 'tired',
                   'stressed', 'lonely']::TEXT[]
  )
);

-- RLS for mood entries
CREATE POLICY "Users can CRUD own moods" ON mood_entries
  USING (auth.uid() = user_id);
CREATE POLICY "Partners can view each other's moods" ON mood_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND partner_id = mood_entries.user_id
    )
  );
```

## Interactions Table

```sql
CREATE TABLE interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES profiles(id),
  receiver_id UUID NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL CHECK (type IN ('poke', 'kiss')),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  is_read BOOLEAN DEFAULT FALSE
);

-- Rate limiting implemented in application layer
-- RLS policies for interaction privacy
```
