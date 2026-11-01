import { Capacitor, registerPlugin } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { isOnline } from '../api/errorHandlers';
import { supabase } from '../api/supabaseClient';

/**
 * Push registration for the native iOS shell.
 *
 * On a signed-in start the shell asks iOS for notification permission once,
 * asks APNs for a device token, and records the token with its APNs
 * environment in `push_devices` through `register_push_device`. The server
 * half is `supabase/functions/send-push`, called by the `love_notes` insert
 * trigger.
 *
 * Everything here is gated on `Capacitor.isNativePlatform()` and then
 * `Capacitor.isPluginAvailable()`: on the web the push plugin reports itself
 * available, and a shell installed before this plugin existed still receives
 * this bundle by live update and must show nothing new.
 *
 * Sign-out stops the device's pushes in two steps (story 3.2):
 * `removePushRegistration` deletes this device's row while the session still
 * exists (online only), then `stopDevicePushes` unregisters from APNs and
 * clears the badge on every transition to signed out. Each native plugin is
 * checked on its own: a shell from story 3.1 has `PushNotifications` but no
 * `AppBadge`.
 *
 * The Settings switches (story 3.7) read the same gate through
 * `hasNativePush()` and ask iOS for the permission state through
 * `getPushPermission()`; their data is `pushPreferencesService`.
 *
 * Story 3.8 adds `clearAppBadge()` (the badge half of sign-out, reused by Love
 * Notes when it marks notes read) and `onForegroundPush(handler)`, which the
 * `pushNotificationReceived` listener fans out to: a push that arrives while
 * the app is in front. The shell shows it badge-only (`capacitor.config.ts`).
 *
 * Not here yet: tap handling (a later story of the epic).
 */

type ApnsEnvironment = 'sandbox' | 'production';

/** `ios/App/App/PushEnvironment.swift`: which APNs host this build's token belongs to. */
interface PushEnvironmentPlugin {
  get(): Promise<{ environment: ApnsEnvironment }>;
}

const PushEnvironment = registerPlugin<PushEnvironmentPlugin>('PushEnvironment');

/** `ios/App/App/AppBadge.swift`: the app icon's badge. */
interface AppBadgePlugin {
  clear(): Promise<void>;
}

const AppBadge = registerPlugin<AppBadgePlugin>('AppBadge');

/**
 * localStorage key holding the APNs token this device last registered with.
 * Device state, not account state: sign-out reads it to remove this device's
 * row and then drops it; an account switch keeps it, because the incoming
 * account's registration moves the same token's row.
 */
export const PUSH_TOKEN_STORAGE_KEY = 'my-love-push-token';

/** Sign-out waits at most this long for the server to drop the registration. */
const UNREGISTER_TIMEOUT_MS = 3_000;

function rememberToken(token: string): void {
  try {
    localStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
  } catch (error) {
    console.error('[Push] Could not remember the device token:', error);
  }
}

function storedToken(): string | null {
  try {
    return localStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function forgetToken(): void {
  try {
    localStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
  } catch (error) {
    console.error('[Push] Could not forget the device token:', error);
  }
}

/** What `startPushRegistration` did, for tests and logs. */
export type PushRegistrationOutcome = 'unavailable' | 'denied' | 'registering';

let listening: Promise<void> | null = null;

const foregroundPushHandlers = new Set<() => void>();

/**
 * Calls `handler` for every push the shell reports while the app is in front.
 * Returns the function that stops it. Handlers may be added before the
 * listener exists; they hear pushes once registration has started.
 */
export function onForegroundPush(handler: () => void): () => void {
  foregroundPushHandlers.add(handler);
  return () => {
    foregroundPushHandlers.delete(handler);
  };
}

/**
 * Whether this shell carries both native pieces push needs. False on the
 * website, in the Home Screen web app and in a shell installed before the
 * push plugins existed.
 */
export function hasNativePush(): boolean {
  return (
    Capacitor.isNativePlatform() &&
    Capacitor.isPluginAvailable('PushNotifications') &&
    Capacitor.isPluginAvailable('PushEnvironment')
  );
}

async function recordDevice(token: string): Promise<void> {
  const { environment } = await PushEnvironment.get();
  const { error } = await supabase.rpc('register_push_device', {
    p_token: token,
    p_environment: environment,
  });
  if (error) {
    console.error('[Push] Could not record the device:', error.message);
  }
}

/** Listens once per page load; every `register()` answers through these. */
function listenOnce(): Promise<void> {
  listening ??= (async () => {
    await PushNotifications.addListener('registration', (token) => {
      rememberToken(token.value);
      void recordDevice(token.value).catch((error: unknown) =>
        console.error('[Push] Could not record the device:', error)
      );
    });
    await PushNotifications.addListener('registrationError', (error) => {
      console.error('[Push] APNs registration failed:', error.error);
    });
    await PushNotifications.addListener('pushNotificationReceived', () => {
      for (const handler of [...foregroundPushHandlers]) {
        try {
          handler();
        } catch (error) {
          console.error('[Push] A foreground push handler failed:', error);
        }
      }
    });
  })().catch((error: unknown) => {
    // A failed setup must not stay cached: the next start tries again.
    listening = null;
    throw error;
  });
  return listening;
}

/** What iOS says about notification permission; `unavailable` when this shell cannot say. */
export type PushPermission = 'granted' | 'denied' | 'prompt' | 'unavailable';

/**
 * iOS's notification permission for this app, without asking for it. Never
 * throws: a shell with no push plugins, or a plugin that fails, answers
 * `unavailable`.
 */
export async function getPushPermission(): Promise<PushPermission> {
  if (!hasNativePush()) return 'unavailable';
  try {
    const { receive } = await PushNotifications.checkPermissions();
    if (receive === 'granted' || receive === 'denied') return receive;
    return 'prompt';
  } catch (error) {
    console.error('[Push] Could not read the notification permission:', error);
    return 'unavailable';
  }
}

/**
 * Registers this device for pushes under the signed-in account. Call after
 * sign-in, on every signed-in start and account switch: APNs may hand out a
 * new token, and a device that changed account must move to it.
 *
 * Permission is asked only when iOS says it has not been asked (`prompt`);
 * iOS shows the alert once per install whatever is called. A person who
 * declined is left alone, with no registration.
 */
export async function startPushRegistration(): Promise<PushRegistrationOutcome> {
  if (!hasNativePush()) return 'unavailable';

  try {
    let { receive } = await PushNotifications.checkPermissions();
    if (receive === 'prompt' || receive === 'prompt-with-rationale') {
      ({ receive } = await PushNotifications.requestPermissions());
    }
    if (receive !== 'granted') return 'denied';

    await listenOnce();
    await PushNotifications.register();
    return 'registering';
  } catch (error) {
    // Push is a non-critical extra: a failure here must never break sign-in.
    console.error('[Push] Registration did not start:', error);
    return 'unavailable';
  }
}

/**
 * Deletes this device's registration under the signed-in account, so its
 * pushes stop reaching the device. Call before `supabase.auth.signOut()`: the
 * RPC needs the session.
 *
 * Online only: offline it sends nothing, and the row stays until APNs reports
 * the token gone (the sender deletes it on a 410) or another account
 * registers the same token. Waits at most ~3 s and never throws: sign-out
 * must not fail or hang on a push.
 */
export async function removePushRegistration(): Promise<void> {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('PushNotifications')) return;
  if (!isOnline()) return;
  const token = storedToken();
  if (!token) return;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timedOut = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), UNREGISTER_TIMEOUT_MS);
    });
    const outcome = await Promise.race([
      Promise.resolve(supabase.rpc('unregister_push_device', { p_token: token })),
      timedOut,
    ]);
    if (outcome === 'timeout') {
      console.error('[Push] Removing the device registration timed out; signing out anyway');
    } else if (outcome.error) {
      console.error('[Push] Could not remove the device registration:', outcome.error.message);
    }
  } catch (error) {
    console.error('[Push] Could not remove the device registration:', error);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Stops this device's pushes natively: unregisters from APNs, clears the app
 * icon's badge and forgets the stored token. Called on every transition to
 * signed out (sign-out online or offline, and a boot that finds the session
 * gone), never on sign-in or an account switch, so it cannot race
 * `startPushRegistration`.
 *
 * Delivered notifications stay in Notification Center. Never throws; logs
 * only failures.
 */
export async function stopDevicePushes(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  if (Capacitor.isPluginAvailable('PushNotifications')) {
    try {
      await PushNotifications.unregister();
    } catch (error) {
      console.error('[Push] Could not unregister from APNs:', error);
    }
  }
  // Not removeAllDeliveredNotifications(): it rejects unless register() ran
  // this launch, and it would also empty Notification Center.
  await clearAppBadge();
  forgetToken();
}

/**
 * Clears the app icon's badge. Does nothing outside the native shell or in a
 * shell with no `AppBadge` plugin (one installed before story 3.2). Never
 * throws; logs only failures. Delivered notifications stay in Notification
 * Center.
 */
export async function clearAppBadge(): Promise<void> {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('AppBadge')) return;
  try {
    await AppBadge.clear();
  } catch (error) {
    console.error('[Push] Could not clear the badge:', error);
  }
}
