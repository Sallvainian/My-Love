# Partner Connection System Design

**Created**: 2025-11-15
**Status**: Design Proposal
**Epic**: 6 (Mood Tracking & Interactions)

---

## Problem Statement

Currently, there is **no way for users to set their partner relationship** in the app. The database schema has a `partner_name` TEXT field but no foreign key relationship, and the RLS policies use `USING (true)` which allows viewing all data from any user.

**Consequences**:
- Users can't connect with their partners after OAuth signup
- The app shows moods from ALL users, not just the partner
- No privacy enforcement at the database level
- The `partner_name` field is unused

---

## Solution: 3-Phase Partner Connection System

### Phase 1: Database Schema Update (Critical)

**Add `partner_id` foreign key to `users` table:**

```sql
-- Migration: Add partner_id column
ALTER TABLE users
ADD COLUMN partner_id UUID REFERENCES users(id);

-- Add index for performance
CREATE INDEX idx_users_partner ON users(partner_id);

-- Update comment to deprecate partner_name
COMMENT ON COLUMN users.partner_name IS 'DEPRECATED: Use partner_id foreign key instead';
```

**Update RLS policies for moods to filter by partner relationship:**

```sql
-- Drop the simplified policy
DROP POLICY "Users can view own and partner moods" ON moods;

-- Create partner-aware policy
CREATE POLICY "Users can view own and partner moods" ON moods
FOR SELECT USING (
  auth.uid() = user_id OR
  auth.uid() IN (
    SELECT partner_id FROM users WHERE id = user_id
  )
);
```

**Similar update for interactions:**
```sql
-- Interactions already use auth.uid() IN (from_user_id, to_user_id)
-- This is correct and doesn't need changes
```

---

### Phase 2: Partner Connection Flow (UI + API)

#### User Experience Flow:

1. **New User Signs Up** (via Google OAuth)
   - Display name setup modal appears ✅ (already implemented)
   - After display name set, show "Connect with Partner" screen

2. **Partner Connection Screen**
   ```
   ┌─────────────────────────────────────┐
   │  💑 Connect with Your Partner       │
   ├─────────────────────────────────────┤
   │                                     │
   │  Enter your partner's email:        │
   │  ┌───────────────────────────────┐  │
   │  │ partner@example.com           │  │
   │  └───────────────────────────────┘  │
   │                                     │
   │  [ Send Connection Request ]        │
   │                                     │
   │  ─── OR ───                         │
   │                                     │
   │  Your Invite Code:                  │
   │  ┌───────────────────────────────┐  │
   │  │  ABC-123-XYZ  [Copy]          │  │
   │  └───────────────────────────────┘  │
   │                                     │
   │  Share this code with your partner  │
   │                                     │
   └─────────────────────────────────────┘
   ```

3. **Partner Receives Request**
   - Email notification: "Your partner wants to connect!"
   - In-app notification with Accept/Decline buttons
   - Shows requester's display name and email

4. **Connection Accepted**
   - Both users' `partner_id` columns are set
   - Confirmation message: "Connected with [Partner Name]! 💕"
   - App redirects to main home screen

#### Alternative Flow: Invite Code
- Each user gets a unique 9-character invite code (e.g., "ABC-123-XYZ")
- Partner enters the code instead of email
- Automatically connects without approval step
- Simpler for privacy-conscious users

---

### Phase 3: Settings & Management

**Settings Screen Additions:**
```
┌─────────────────────────────────────┐
│  ⚙️ Settings                         │
├─────────────────────────────────────┤
│                                     │
│  👤 Account                          │
│     Display Name: (Almost) Fiance  │
│     Email: frank.cottone97@gmail...│
│     [ Edit Display Name ]           │
│     [ Sign Out ]                    │
│                                     │
│  💑 Partner                          │
│     Connected: Yes                  │
│     Partner: [Partner Display Name] │
│     [ Disconnect ]                  │
│                                     │
│  ⚠️ Disconnect Partner?             │
│     This will:                      │
│     - Remove partner relationship   │
│     - Hide their moods from you     │
│     - Hide your moods from them     │
│     [ Cancel ] [ Disconnect ]       │
│                                     │
└─────────────────────────────────────┘
```

**If No Partner Connected:**
```
│  💑 Partner                          │
│     Status: Not Connected           │
│     [ Connect with Partner ]        │
```

---

## Technical Implementation

### 1. Database Migration

**File**: `docs/migrations/002_add_partner_id.sql`

```sql
-- Migration 002: Add partner_id relationship
-- Created: 2025-11-15

BEGIN;

-- Add partner_id column
ALTER TABLE users
ADD COLUMN partner_id UUID REFERENCES users(id);

-- Add index for performance
CREATE INDEX idx_users_partner ON users(partner_id);

-- Update RLS policy for moods to filter by partner
DROP POLICY IF EXISTS "Users can view own and partner moods" ON moods;

CREATE POLICY "Users can view own and partner moods" ON moods
FOR SELECT USING (
  auth.uid() = user_id OR
  auth.uid() IN (
    SELECT partner_id FROM users WHERE id = user_id
    UNION
    SELECT id FROM users WHERE partner_id = auth.uid()
  )
);

-- Add comment to deprecate partner_name
COMMENT ON COLUMN users.partner_name IS 'DEPRECATED: Use partner_id foreign key instead. Will be removed in future migration.';

COMMIT;
```

### 2. Partner Service API

**File**: `src/api/partnerService.ts`

```typescript
import { supabase } from './supabaseClient';
import type { User } from '@supabase/supabase-js';

export interface PartnerInfo {
  id: string;
  displayName: string;
  email: string;
  connectedAt: string;
}

export interface PartnerRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

class PartnerService {
  /**
   * Get current user's partner information
   */
  async getPartner(): Promise<PartnerInfo | null> {
    const { data: currentUser } = await supabase.auth.getUser();
    if (!currentUser?.user) return null;

    // Get user record with partner_id
    const { data: userRecord, error } = await supabase
      .from('users')
      .select('partner_id')
      .eq('id', currentUser.user.id)
      .single();

    if (error || !userRecord?.partner_id) return null;

    // Get partner's auth data
    const { data: partnerAuth } = await supabase.auth.admin.getUserById(
      userRecord.partner_id
    );

    if (!partnerAuth?.user) return null;

    return {
      id: partnerAuth.user.id,
      displayName: partnerAuth.user.user_metadata?.display_name || 'Partner',
      email: partnerAuth.user.email || '',
      connectedAt: userRecord.updated_at,
    };
  }

  /**
   * Send partner connection request by email
   */
  async sendPartnerRequest(partnerEmail: string): Promise<void> {
    const { data: currentUser } = await supabase.auth.getUser();
    if (!currentUser?.user) throw new Error('Not authenticated');

    // Find partner by email
    const { data: partnerAuth } = await supabase.auth.admin.listUsers();
    const partner = partnerAuth?.users?.find(u => u.email === partnerEmail);

    if (!partner) {
      throw new Error('No user found with that email address');
    }

    // Create partner_requests table entry
    const { error } = await supabase.from('partner_requests').insert({
      from_user_id: currentUser.user.id,
      to_user_id: partner.id,
      status: 'pending',
    });

    if (error) throw error;

    // TODO: Send email notification to partner
  }

  /**
   * Accept partner connection request
   */
  async acceptPartnerRequest(requestId: string): Promise<void> {
    const { data: currentUser } = await supabase.auth.getUser();
    if (!currentUser?.user) throw new Error('Not authenticated');

    // Get the request
    const { data: request, error: fetchError } = await supabase
      .from('partner_requests')
      .select('*')
      .eq('id', requestId)
      .eq('to_user_id', currentUser.user.id)
      .eq('status', 'pending')
      .single();

    if (fetchError || !request) {
      throw new Error('Partner request not found');
    }

    // Update both users' partner_id in a transaction
    const { error: updateError } = await supabase.rpc('accept_partner_request', {
      request_id: requestId,
      user1_id: request.from_user_id,
      user2_id: request.to_user_id,
    });

    if (updateError) throw updateError;
  }

  /**
   * Disconnect from current partner
   */
  async disconnectPartner(): Promise<void> {
    const { data: currentUser } = await supabase.auth.getUser();
    if (!currentUser?.user) throw new Error('Not authenticated');

    const { error } = await supabase.rpc('disconnect_partner', {
      user_id: currentUser.user.id,
    });

    if (error) throw error;
  }

  /**
   * Generate invite code for current user
   */
  async generateInviteCode(): Promise<string> {
    // TODO: Implement invite code system
    // Could use user ID + short hash for verification
    return 'ABC-123-XYZ';
  }

  /**
   * Connect using invite code
   */
  async connectWithInviteCode(inviteCode: string): Promise<void> {
    // TODO: Implement invite code validation
    throw new Error('Not implemented');
  }
}

export const partnerService = new PartnerService();
```

### 3. Database Functions (RPC)

**Add to migration or separate file:**

```sql
-- Function to accept partner request (atomic transaction)
CREATE OR REPLACE FUNCTION accept_partner_request(
  request_id UUID,
  user1_id UUID,
  user2_id UUID
) RETURNS void AS $$
BEGIN
  -- Update both users' partner_id
  UPDATE users SET partner_id = user2_id WHERE id = user1_id;
  UPDATE users SET partner_id = user1_id WHERE id = user2_id;

  -- Mark request as accepted
  UPDATE partner_requests
  SET status = 'accepted'
  WHERE id = request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to disconnect partners (atomic transaction)
CREATE OR REPLACE FUNCTION disconnect_partner(
  user_id UUID
) RETURNS void AS $$
DECLARE
  partner_id UUID;
BEGIN
  -- Get current partner_id
  SELECT users.partner_id INTO partner_id
  FROM users
  WHERE id = user_id;

  -- Clear both users' partner_id
  UPDATE users SET partner_id = NULL WHERE id = user_id;
  UPDATE users SET partner_id = NULL WHERE id = partner_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 4. Partner Requests Table

```sql
CREATE TABLE partner_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Prevent duplicate requests
CREATE UNIQUE INDEX idx_partner_requests_unique
ON partner_requests(from_user_id, to_user_id)
WHERE status = 'pending';

-- RLS policies
ALTER TABLE partner_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create partner requests" ON partner_requests
FOR INSERT WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can view their requests" ON partner_requests
FOR SELECT USING (auth.uid() IN (from_user_id, to_user_id));

CREATE POLICY "Users can update received requests" ON partner_requests
FOR UPDATE USING (auth.uid() = to_user_id);
```

### 5. React Components

**`src/components/PartnerConnection/PartnerConnection.tsx`** - Connection flow modal
**`src/components/Settings/PartnerSettings.tsx`** - Settings screen section
**`src/stores/slices/partnerSlice.ts`** - Zustand state management

---

## Security Considerations

1. **RLS Policy Enforcement**: New policy ensures users can only see their partner's moods
2. **Atomic Transactions**: Partner connection/disconnection uses database functions to prevent race conditions
3. **Unique Constraint**: Prevents duplicate pending requests between same users
4. **Cascading Deletes**: If a user is deleted, all their partner requests are removed
5. **Email Verification**: Only verified email addresses can send partner requests

---

## Migration Path

### From Current State:
1. ✅ Remove `VITE_USER_ID` and `VITE_PARTNER_ID` from .env (completed)
2. ✅ Update README to reflect OAuth authentication (completed)
3. ⏳ Execute database migration 002 (add `partner_id` column)
4. ⏳ Create `partner_requests` table
5. ⏳ Implement `PartnerService` API
6. ⏳ Create `PartnerConnection` UI component
7. ⏳ Add partner settings to Settings screen
8. ⏳ Update app initialization to check partner status

### Testing Strategy:
- **Unit Tests**: Test `partnerService` methods
- **Integration Tests**: Test database functions and RLS policies
- **E2E Tests**: Test full partner connection flow with Playwright
- **Manual Testing**: Verify UI flow with two real accounts

---

## User Flow Example

**Alice's Journey:**
1. Signs up with Google OAuth → Sets display name "Alice"
2. Sees "Connect with Partner" screen
3. Enters Bob's email: bob@example.com
4. Sees "Request sent! Waiting for Bob to accept..."

**Bob's Journey:**
1. Already has account, signed in
2. Receives notification: "Alice wants to connect!"
3. Clicks "Accept" → Sees "Connected with Alice! 💕"
4. Can now see Alice's moods and send pokes/kisses

**Both Users:**
- Home screen shows partner's latest mood
- Mood history shows both users' moods
- Settings → Partner shows connection status
- Can disconnect at any time (requires confirmation)

---

## Questions for Review

1. **Email vs Invite Code**: Should we support both, or just one? Email is simpler but less private.
2. **Auto-Accept**: Should there be an option to skip the accept/decline step for invite codes?
3. **Multiple Partners**: Current design enforces 1:1 relationship. Is this correct?
4. **Reconnection**: If users disconnect, can they reconnect? Should we keep history?
5. **Partner Name Field**: Should we remove `partner_name` column entirely or keep for backward compatibility?

---

## Next Steps

After review and approval:
1. Create database migration file
2. Execute migration via Supabase MCP
3. Implement `partnerService.ts`
4. Create UI components
5. Update app initialization flow
6. Write tests
7. Document in README

---

**Status**: Awaiting user feedback before implementation.
