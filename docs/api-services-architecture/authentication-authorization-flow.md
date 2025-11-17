# Authentication & Authorization Flow

## Sign-Up Flow

```
User enters email/password
  ↓
authService.signUp(credentials)
  ↓
Supabase Auth creates user
  ↓
Creates JWT tokens (access + refresh)
  ↓
Browser persists tokens (localStorage)
  ↓
App subscribes to auth state changes
  ↓
Display onboarding or main app
```

## Sign-In Flow

```
User enters email/password
  ↓
authService.signIn(credentials)
  ↓
Supabase validates credentials
  ↓
JWT tokens returned
  ↓
Browser persists tokens
  ↓
Token auto-refresh handles expiry
  ↓
User can access protected resources
```

## Google OAuth Flow

```
User clicks "Sign in with Google"
  ↓
authService.signInWithGoogle()
  ↓
Redirect to Google login page
  ↓
User authenticates with Google
  ↓
Google redirects back to app with auth code
  ↓
Supabase exchanges code for JWT tokens
  ↓
Creates user record with email from Google profile
  ↓
Browser persists tokens
  ↓
App is now authenticated
```

## Row Level Security (RLS)

```
All API queries include JWT token
  ↓
Database checks auth.uid() in policies
  ↓
User can only access their own data
  ↓
Partner data accessible only if partner_id matches
  ↓
Queries filtered at database layer (secure)
```

**Example RLS Policy**:

```sql
-- Allow users to read only their own moods
CREATE POLICY "users_can_read_own_moods" ON moods
  FOR SELECT USING (auth.uid() = user_id);

-- Allow users to read partner's moods if connected
CREATE POLICY "users_can_read_partner_moods" ON moods
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM users WHERE partner_id = moods.user_id
    )
  );
```

---
