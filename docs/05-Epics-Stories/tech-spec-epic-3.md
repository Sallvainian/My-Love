# Tech Spec: Epic 3 - Push Notifications & Daily Engagement

## Overview

**Epic**: Push Notifications & Daily Engagement
**Status**: Ready for Development
**Dependencies**: Epic 1 (Core MVP), Epic 2 (Partner Connection) - Completed
**Branch**: `feature/epic-3-push-notifications`

This epic implements Web Push notifications to create persistent engagement between partners even when the app is closed. It covers permission flows, subscription management, real-time notifications for love notes, and scheduled daily love messages.

---

## Stories Summary

| Story | Title | Priority | Complexity |
|-------|-------|----------|------------|
| 3.0 | Push Notification & Daily Messages Schema Setup | High | Medium |
| 3.1 | Notification Permission Flow | High | Low |
| 3.2 | Push Subscription Registration & Storage | High | Medium |
| 3.3 | Love Note Push Notifications | High | High |
| 3.4 | Daily Love Message Notifications | Medium | High |
| 3.5 | Notification URL Routing | Medium | Low |
| 3.6 | In-App Notification History | Low | Medium |

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (PWA)                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Permission   │  │ Subscription │  │ Service Worker       │   │
│  │ Flow UI      │  │ Manager      │  │ (push event handler) │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Backend                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────────────────────────┐ │
│  │ Database         │  │ Edge Functions                       │ │
│  │ - push_subs      │  │ - send-push-notification             │ │
│  │ - daily_messages │  │ - send-daily-love-message            │ │
│  │ - notifications  │  │ - rotate-daily-message (cron)        │ │
│  └──────────────────┘  └──────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Database Triggers                                         │   │
│  │ - on love_notes INSERT → invoke send-push-notification    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Web Push Services                             │
│  (FCM/APNS via web-push library)                                │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow: Love Note Push Notification

```
1. User A creates love note
         │
         ▼
2. love_notes INSERT triggers database function
         │
         ▼
3. Database function invokes Edge Function (send-push-notification)
         │
         ▼
4. Edge Function:
   a. Looks up partner's push subscriptions
   b. Sends web-push to each subscription endpoint
         │
         ▼
5. Push service delivers to partner's device
         │
         ▼
6. Service Worker receives push event
         │
         ▼
7. SW shows notification with partner's name & message preview
         │
         ▼
8. User clicks → SW handles notificationclick → opens app with URL
```

---

## Database Schema

### New Tables

#### `push_subscriptions`

Stores Web Push API subscription objects for each user's devices.

```sql
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  device_info JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,

  UNIQUE(user_id, endpoint)
);

-- Index for fast partner lookup
CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- Index for endpoint cleanup (when removing failed subscriptions)
CREATE INDEX idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);

-- RLS Policies
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own subscriptions"
  ON push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id);

-- Service role can read for sending notifications
CREATE POLICY "Service role can read all subscriptions"
  ON push_subscriptions
  FOR SELECT
  USING (auth.role() = 'service_role');
```

#### `daily_love_messages`

Pool of romantic messages for daily notifications.

```sql
CREATE TABLE daily_love_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  created_by UUID REFERENCES auth.users(id),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure custom messages always have a creator (RLS safety)
  CONSTRAINT chk_custom_has_creator CHECK (is_default = true OR created_by IS NOT NULL)
);

-- Seed with default messages
INSERT INTO daily_love_messages (content, category, is_default) VALUES
  ('Good morning, beautiful! You make every day brighter.', 'morning', true),
  ('Just thinking about you and smiling.', 'general', true),
  ('You are my favorite notification.', 'general', true),
  ('Sending you a virtual hug right now!', 'affection', true),
  ('Remember: you are loved more than you know.', 'affirmation', true),
  ('Can''t wait to see your smile again.', 'longing', true),
  ('You make my heart skip a beat.', 'romantic', true),
  ('Every moment with you is a treasure.', 'appreciation', true);

-- RLS: Anyone can read defaults, users can create custom
ALTER TABLE daily_love_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read default messages"
  ON daily_love_messages
  FOR SELECT
  USING (is_default = true);

CREATE POLICY "Users can manage their custom messages"
  ON daily_love_messages
  FOR ALL
  USING (created_by = auth.uid());
```

#### `notifications` (In-App History)

Stores notification history for in-app viewing.

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'love_note', 'daily_message', 'partner_mood', etc.
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days') -- Auto-cleanup after 30 days
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, read);
CREATE INDEX idx_notifications_expires ON notifications(expires_at); -- For cleanup cron

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their notifications"
  ON notifications
  FOR ALL
  USING (auth.uid() = user_id);
```

### TypeScript Types Update

Add to `src/types/database.types.ts`:

```typescript
// These will be auto-generated by `supabase gen types typescript`
// After running migration, regenerate types

push_subscriptions: {
  Row: {
    id: string;
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    device_info: Json | null;
    created_at: string | null;
    updated_at: string | null;
    last_used_at: string | null;
  };
  Insert: {
    id?: string;
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    device_info?: Json | null;
    created_at?: string | null;
    updated_at?: string | null;
    last_used_at?: string | null;
  };
  Update: {
    // ... partial fields
  };
};

daily_love_messages: {
  Row: {
    id: string;
    content: string;
    category: string | null;
    created_by: string | null;
    is_default: boolean | null;
    created_at: string | null;
  };
  // ...
};

notifications: {
  Row: {
    id: string;
    user_id: string;
    type: string;
    title: string;
    body: string | null;
    data: Json | null;
    read: boolean | null;
    created_at: string | null;
    expires_at: string | null; // Auto-cleanup after 30 days
  };
  // ...
};
```

---

## Story Implementations

### Story 3.0: Push Notification & Daily Messages Schema Setup

**Files to Create/Modify**:
- `supabase/migrations/YYYYMMDD_push_notifications_schema.sql`

**Implementation**:
1. Create migration with all three tables (push_subscriptions, daily_love_messages, notifications)
2. Set up RLS policies
3. Seed default daily love messages
4. Regenerate TypeScript types: `supabase gen types typescript --local > src/types/database.types.ts`

**Acceptance Criteria**:
- [ ] All tables created with proper constraints
- [ ] RLS policies enforce user-scoped access
- [ ] Default daily messages seeded
- [ ] TypeScript types regenerated and type-check passes

---

### Story 3.1: Notification Permission Flow

**Files to Create/Modify**:
- `src/components/NotificationPermission.tsx` (new)
- `src/hooks/useNotificationPermission.ts` (new)
- `src/stores/notificationStore.ts` (new)

**Implementation**:

```typescript
// src/hooks/useNotificationPermission.ts
import { useState, useEffect, useCallback } from 'react';

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export function useNotificationPermission() {
  const [permission, setPermission] = useState<PermissionState>('default');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!('Notification' in window)) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission as PermissionState);
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) return false;

    setIsLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);
      return result === 'granted';
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { permission, requestPermission, isLoading };
}
```

```typescript
// src/components/NotificationPermission.tsx
import { useNotificationPermission } from '../hooks/useNotificationPermission';
import { Bell, BellOff, X } from 'lucide-react';

interface Props {
  onDismiss?: () => void;
  onPermissionGranted?: () => void;
}

export function NotificationPermission({ onDismiss, onPermissionGranted }: Props) {
  const { permission, requestPermission, isLoading } = useNotificationPermission();

  if (permission === 'granted' || permission === 'unsupported') {
    return null;
  }

  const handleEnable = async () => {
    const granted = await requestPermission();
    if (granted && onPermissionGranted) {
      onPermissionGranted();
    }
  };

  if (permission === 'denied') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
        <BellOff className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-amber-800">
            Notifications are blocked. Enable them in your browser settings to receive love notes from your partner.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-pink-50 border border-pink-200 rounded-lg p-4 flex items-start gap-3">
      <Bell className="w-5 h-5 text-pink-500 shrink-0 mt-0.5" />
      <div className="flex-1">
        <h3 className="text-sm font-medium text-pink-800">
          Stay Connected
        </h3>
        <p className="text-sm text-pink-700 mt-1">
          Enable notifications to receive instant love notes from your partner, even when the app is closed.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleEnable}
            disabled={isLoading}
            className="px-3 py-1.5 bg-pink-500 text-white text-sm rounded-md hover:bg-pink-600 disabled:opacity-50"
          >
            {isLoading ? 'Enabling...' : 'Enable Notifications'}
          </button>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 text-pink-600 text-sm hover:text-pink-700"
            >
              Maybe Later
            </button>
          )}
        </div>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="text-pink-400 hover:text-pink-500">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
```

**Acceptance Criteria**:
- [ ] Permission banner shows on first visit (if not granted)
- [ ] "Enable Notifications" triggers browser permission prompt
- [ ] Graceful handling for denied permissions
- [ ] Unsupported browsers show no banner
- [ ] Dismissal persists (localStorage flag)

---

### Story 3.2: Push Subscription Registration & Storage

**Files to Create/Modify**:
- `src/services/pushService.ts` (new)
- `src/sw.ts` (modify - add push event handler)
- `.env` (add VAPID keys)

**VAPID Key Setup**:

```bash
# Generate VAPID keys (one-time, store securely)
npx web-push generate-vapid-keys

# Add to .env
VITE_VAPID_PUBLIC_KEY=your_public_key_here

# Add to Supabase Edge Function secrets (not in .env)
# VAPID_PRIVATE_KEY=your_private_key_here
# VAPID_SUBJECT=mailto:your-email@example.com
```

**Implementation**:

```typescript
// src/services/pushService.ts
import { supabase } from '../api/supabaseClient';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[PushService] Push notifications not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Create new subscription
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    // Store subscription in Supabase
    await saveSubscription(subscription);

    return subscription;
  } catch (error) {
    console.error('[PushService] Failed to subscribe:', error);
    return null;
  }
}

async function saveSubscription(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON();

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      endpoint: json.endpoint!,
      p256dh: json.keys!.p256dh,
      auth: json.keys!.auth,
      device_info: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
      },
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,endpoint',
    });

  if (error) {
    console.error('[PushService] Failed to save subscription:', error);
    throw error;
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    // Remove from Supabase
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', subscription.endpoint);

    // Unsubscribe locally
    await subscription.unsubscribe();
  }
}
```

**Service Worker Push Handler** (add to `src/sw.ts`):

```typescript
// Add to existing sw.ts

/**
 * Push Event Handler
 *
 * Receives push messages from the server and displays notifications.
 */
self.addEventListener('push', ((event: PushEvent) => {
  if (!event.data) {
    console.log('[ServiceWorker] Push event with no data');
    return;
  }

  try {
    const payload = event.data.json();
    console.log('[ServiceWorker] Push received:', payload);

    const options: NotificationOptions = {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: payload.tag || 'my-love-notification',
      data: payload.data || {},
      vibrate: [100, 50, 100],
      actions: payload.actions || [],
      requireInteraction: payload.requireInteraction || false,
    };

    event.waitUntil(
      self.registration.showNotification(payload.title, options)
    );
  } catch (error) {
    console.error('[ServiceWorker] Failed to process push:', error);
  }
}) as EventListener);

/**
 * Notification Click Handler
 *
 * Opens the app and navigates to the relevant page when notification is clicked.
 */
self.addEventListener('notificationclick', ((event: NotificationEvent) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if app is already open
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            client.postMessage({
              type: 'NOTIFICATION_CLICKED',
              url: urlToOpen,
            });
            return;
          }
        }
        // Open new window
        return self.clients.openWindow(urlToOpen);
      })
  );
}) as EventListener);
```

**Acceptance Criteria**:
- [ ] VAPID keys generated and configured
- [ ] Push subscription created on permission grant
- [ ] Subscription stored in Supabase push_subscriptions table
- [ ] Subscription updates on revisit (upsert)
- [ ] Service worker handles push events
- [ ] Notification click opens app

---

### Story 3.3: Love Note Push Notifications

**Files to Create/Modify**:
- `supabase/functions/send-push-notification/index.ts` (new)
- `supabase/migrations/YYYYMMDD_love_note_trigger.sql` (new)

**Edge Function Implementation**:

```typescript
// supabase/functions/send-push-notification/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7'; // Battle-tested Web Push library

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Initialize web-push with VAPID credentials
webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') || 'mailto:hello@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!
);

// Send Web Push notification using web-push library
async function sendWebPush(subscription: any, payload: any): Promise<boolean> {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload),
      {
        TTL: 86400, // 24 hours
      }
    );
    return true;
  } catch (error) {
    // Handle expired/invalid subscriptions (410 Gone, 404 Not Found)
    if (error.statusCode === 410 || error.statusCode === 404) {
      console.log(`Subscription expired: ${subscription.endpoint}`);
    } else {
      console.error(`Push failed: ${error.message}`);
    }
    return false;
  }
}

serve(async (req) => {
  try {
    const { type, recipientUserId, title, body, data } = await req.json();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get recipient's push subscriptions
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', recipientUserId);

    if (error) throw error;

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No subscriptions' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    const payload = {
      title,
      body,
      tag: type,
      data: {
        ...data,
        url: data?.url || '/',
      },
    };

    let successCount = 0;
    const failedEndpoints: string[] = [];

    for (const sub of subscriptions) {
      try {
        const success = await sendWebPush(sub, payload);
        if (success) {
          successCount++;
          // Update last_used_at
          await supabase
            .from('push_subscriptions')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', sub.id);
        } else {
          failedEndpoints.push(sub.endpoint);
        }
      } catch (pushError) {
        console.error('Push failed for endpoint:', sub.endpoint, pushError);
        failedEndpoints.push(sub.endpoint);
      }
    }

    // Clean up expired subscriptions
    if (failedEndpoints.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', failedEndpoints);
    }

    // Store in notifications table for in-app history
    await supabase.from('notifications').insert({
      user_id: recipientUserId,
      type,
      title,
      body,
      data,
    });

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: failedEndpoints.length,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

**Database Trigger**:

```sql
-- supabase/migrations/YYYYMMDD_love_note_trigger.sql

-- Function to trigger push notification on love note insert
CREATE OR REPLACE FUNCTION notify_love_note()
RETURNS TRIGGER AS $$
DECLARE
  sender_name TEXT;
BEGIN
  -- Get sender's display name
  SELECT display_name INTO sender_name
  FROM public.users
  WHERE id = NEW.from_user_id;

  -- Invoke Edge Function (async via pg_net or http extension)
  PERFORM net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := jsonb_build_object(
      'type', 'love_note',
      'recipientUserId', NEW.to_user_id,
      'title', COALESCE(sender_name, 'Your Partner') || ' sent you a love note',
      'body', LEFT(NEW.content, 100),
      'data', jsonb_build_object('noteId', NEW.id, 'url', '/notes')
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on love_notes insert
CREATE TRIGGER on_love_note_created
  AFTER INSERT ON love_notes
  FOR EACH ROW
  EXECUTE FUNCTION notify_love_note();
```

**Acceptance Criteria**:
- [ ] Edge Function deployed and callable
- [ ] Database trigger fires on love_notes insert
- [ ] Push notification delivered to partner's devices
- [ ] Notification includes sender name and message preview
- [ ] Failed subscriptions cleaned up automatically
- [ ] Notification stored in history table

---

### Story 3.4: Daily Love Message Notifications

**Files to Create/Modify**:
- `supabase/functions/send-daily-love-message/index.ts` (new)
- Supabase cron job configuration

**Edge Function**:

```typescript
// supabase/functions/send-daily-love-message/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // Get all users with active push subscriptions
    const { data: usersWithSubs } = await supabase
      .from('push_subscriptions')
      .select('user_id')
      .not('user_id', 'is', null);

    const uniqueUserIds = [...new Set(usersWithSubs?.map(s => s.user_id) || [])];

    // Get a random daily message
    const { data: messages } = await supabase
      .from('daily_love_messages')
      .select('content')
      .eq('is_default', true);

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'No messages configured' }), { status: 400 });
    }

    const randomMessage = messages[Math.floor(Math.random() * messages.length)];

    // Send to each user
    let sent = 0;
    for (const userId of uniqueUserIds) {
      // Check if user has a partner (only send if connected)
      const { data: user } = await supabase
        .from('users')
        .select('partner_id, display_name')
        .eq('id', userId)
        .single();

      if (user?.partner_id) {
        // Invoke the send-push-notification function
        await supabase.functions.invoke('send-push-notification', {
          body: {
            type: 'daily_message',
            recipientUserId: userId,
            title: 'Daily Love Reminder',
            body: randomMessage.content,
            data: { url: '/' },
          },
        });
        sent++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, usersSent: sent }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
});
```

**Cron Configuration** (in Supabase Dashboard or via SQL):

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily at 7:15 AM EST (12:15 PM UTC)
-- Note: EST is UTC-5. During EDT (daylight saving), adjust to 11:15 UTC if needed
SELECT cron.schedule(
  'daily-love-message',
  '15 12 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/send-daily-love-message',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Cleanup expired notifications daily at 3 AM UTC
SELECT cron.schedule(
  'cleanup-expired-notifications',
  '0 3 * * *',
  $$
  DELETE FROM notifications WHERE expires_at < NOW();
  $$
);
```

**Acceptance Criteria**:
- [ ] Edge Function sends random daily message
- [ ] Cron job runs at 7:15 AM EST (12:15 PM UTC)
- [ ] Only users with partners receive messages
- [ ] Messages rotate (different each day)
- [ ] Expired notifications cleaned up automatically (30-day retention)
- [ ] Users can configure preferred time (future enhancement)

---

### Story 3.5: Notification URL Routing

**Files to Modify**:
- `src/sw.ts` (already covered in 3.2)
- `src/App.tsx` or router configuration

**Implementation**:

The service worker's `notificationclick` handler (from Story 3.2) opens the app with a URL. The app needs to handle these URLs:

```typescript
// In App.tsx or a NotificationHandler component
useEffect(() => {
  // Handle messages from service worker
  const handleMessage = (event: MessageEvent) => {
    if (event.data?.type === 'NOTIFICATION_CLICKED') {
      const url = event.data.url;
      // Navigate to the URL
      navigate(url);
    }
  };

  navigator.serviceWorker?.addEventListener('message', handleMessage);
  return () => {
    navigator.serviceWorker?.removeEventListener('message', handleMessage);
  };
}, [navigate]);
```

**URL Routing Map**:
| Notification Type | URL | Destination |
|-------------------|-----|-------------|
| love_note | `/notes` | Love Notes page |
| daily_message | `/` | Home page |
| partner_mood | `/mood` | Mood page |

**Acceptance Criteria**:
- [ ] Clicking notification opens app
- [ ] App navigates to correct page based on notification type
- [ ] Deep linking works when app is closed
- [ ] Back navigation works correctly after deep link

---

### Story 3.6: In-App Notification History

**Files to Create/Modify**:
- `src/components/NotificationHistory.tsx` (new)
- `src/hooks/useNotifications.ts` (new)

**Implementation**:

```typescript
// src/hooks/useNotifications.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../api/supabaseClient';

export function useNotifications() {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    isLoading,
    markAsRead: markAsRead.mutate,
    markAllAsRead: markAllAsRead.mutate,
    unreadCount,
  };
}
```

```typescript
// src/components/NotificationHistory.tsx
import { useNotifications } from '../hooks/useNotifications';
import { Bell, Check, Heart, MessageCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function NotificationHistory() {
  const { notifications, isLoading, markAsRead, markAllAsRead, unreadCount } = useNotifications();

  const getIcon = (type: string) => {
    switch (type) {
      case 'love_note': return <MessageCircle className="w-5 h-5 text-pink-500" />;
      case 'daily_message': return <Heart className="w-5 h-5 text-red-500" />;
      default: return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  if (isLoading) {
    return <div className="p-4 text-center">Loading...</div>;
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Notifications</h2>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllAsRead()}
            className="text-sm text-pink-500 hover:text-pink-600"
          >
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No notifications yet</p>
        </div>
      ) : (
        <ul className="divide-y">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              onClick={() => !notification.read && markAsRead(notification.id)}
              className={`p-4 flex gap-3 cursor-pointer hover:bg-gray-50 ${
                !notification.read ? 'bg-pink-50' : ''
              }`}
            >
              <div className="shrink-0 mt-1">
                {getIcon(notification.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${!notification.read ? 'font-medium' : ''}`}>
                  {notification.title}
                </p>
                {notification.body && (
                  <p className="text-sm text-gray-500 truncate">
                    {notification.body}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                </p>
              </div>
              {!notification.read && (
                <div className="w-2 h-2 bg-pink-500 rounded-full shrink-0 mt-2" />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

**Acceptance Criteria**:
- [ ] Notification history displays in-app
- [ ] Unread notifications visually distinguished
- [ ] Mark individual/all as read
- [ ] Unread count badge on nav icon
- [ ] Clicking notification navigates to relevant content

---

## Environment Variables

### Client-Side (.env)

```bash
# Existing
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-anon-key

# New for Epic 3
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key
```

### Supabase Edge Function Secrets

```bash
# Set via Supabase CLI or Dashboard
supabase secrets set VAPID_PRIVATE_KEY=your-vapid-private-key
supabase secrets set VAPID_PUBLIC_KEY=your-vapid-public-key
supabase secrets set VAPID_SUBJECT=mailto:your-email@example.com
```

---

## Testing Strategy

### Unit Tests

```typescript
// src/hooks/useNotificationPermission.test.ts
describe('useNotificationPermission', () => {
  it('detects unsupported browsers', () => {
    // Mock window.Notification as undefined
  });

  it('returns current permission state', () => {
    // Mock Notification.permission
  });

  it('requests permission and updates state', async () => {
    // Mock Notification.requestPermission
  });
});
```

### Integration Tests

- Test push subscription flow end-to-end
- Test notification click → app navigation
- Test Edge Function with mock data

### E2E Tests (Playwright)

```typescript
test('notification permission flow', async ({ page }) => {
  // Grant notification permission via browser context
  await context.grantPermissions(['notifications']);

  await page.goto('/');

  // Verify no permission banner when granted
  await expect(page.locator('[data-testid="notification-banner"]')).not.toBeVisible();
});
```

---

## Migration Checklist

1. [ ] Generate VAPID keys and store securely
2. [ ] Create database migration for new tables
3. [ ] Deploy Edge Functions
4. [ ] Configure pg_cron for daily messages
5. [ ] Update TypeScript types
6. [ ] Implement client-side components
7. [ ] Update service worker
8. [ ] Test end-to-end on staging
9. [ ] Update sprint-status.yaml to "in-progress"

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Push service rate limits | Batch notifications, implement retry with backoff |
| Expired subscriptions | Clean up on failed delivery, re-subscribe on visit |
| Browser compatibility | Feature detection, graceful degradation |
| User opts out | Respect permission, provide in-app alternatives |
| Edge Function cold starts | Keep functions warm, use connection pooling |

---

## Success Metrics

- Push notification delivery rate > 95%
- Daily message engagement rate > 30%
- Permission grant rate > 60%
- Notification click-through rate > 40%

---

## References

- [Web Push Protocol](https://datatracker.ietf.org/doc/html/rfc8030)
- [VAPID Spec](https://datatracker.ietf.org/doc/html/rfc8292)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Service Worker Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
