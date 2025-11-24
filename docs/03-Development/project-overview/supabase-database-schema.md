# Supabase Database Schema

## Tables

- **profiles**: User display names and partner info
- **mood_entries**: Mood tracking with multi-emotion support
- **interactions**: Poke/kiss partner interactions

## Row Level Security

All tables enforce user ownership:

```sql
CREATE POLICY "Users can view own data"
ON mood_entries FOR SELECT
USING (auth.uid() = user_id);
```
