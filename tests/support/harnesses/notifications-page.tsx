/**
 * Mounts the real Settings > Notifications page (`NotificationsPage`) in a browser, for the
 * account whose Supabase session the E2E fixture already put in this origin's storage.
 *
 * The page itself renders only where `hasNativePush()` is true (`Settings.tsx`), so a browser
 * never reaches it through Settings (`tests/e2e/settings/push-switches-web.spec.ts`). This
 * harness skips that gate and nothing else: the page, the store, the preferences service and
 * the `supabase` client are the production ones, so every request is the one the iOS shell
 * would make. No plugin is available here, so the page shows no permission notice and no
 * Reminders group.
 */
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase } from '../../../src/api/supabaseClient';
import { NotificationsPage } from '../../../src/components/Settings/NotificationsPage';
import type { PushPreferences } from '../../../src/services/pushPreferencesService';
import { useAppStore } from '../../../src/stores/useAppStore';
import '../../../src/index.css';

export type NotificationsPageBridge = {
  userId: string;
  /** The switches the store holds now, or null before the first answer. */
  preferences: () => PushPreferences | null;
};

declare global {
  interface Window {
    __notificationsPage?: NotificationsPageBridge;
    __notificationsPageError?: string;
  }
}

async function mount(): Promise<void> {
  const container = document.getElementById('root');
  if (!container) throw new Error('Harness has no root element');
  const { data, error } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (error || !user) throw new Error('Harness requires a signed-in session in this origin');

  // The same call `onAuthStateChange` makes, so the page's loads and saves know the account.
  useAppStore.getState().setAuthUser(user.id, user.email ?? null);
  createRoot(container).render(createElement(NotificationsPage));
  window.__notificationsPage = {
    userId: user.id,
    preferences: () => useAppStore.getState().pushPreferences,
  };
}

mount().catch((error: unknown) => {
  window.__notificationsPageError = error instanceof Error ? error.message : String(error);
});
