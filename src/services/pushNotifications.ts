import { Capacitor, registerPlugin } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
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
 * Not here yet: unregistering on sign-out, the Settings switches, the badge,
 * tap handling and foreground suppression (later stories of the epic).
 */

type ApnsEnvironment = 'sandbox' | 'production';

/** `ios/App/App/PushEnvironment.swift`: which APNs host this build's token belongs to. */
interface PushEnvironmentPlugin {
  get(): Promise<{ environment: ApnsEnvironment }>;
}

const PushEnvironment = registerPlugin<PushEnvironmentPlugin>('PushEnvironment');

/** What `startPushRegistration` did, for tests and logs. */
export type PushRegistrationOutcome = 'unavailable' | 'denied' | 'registering';

let listening: Promise<void> | null = null;

/** Whether this shell carries both native pieces push needs. */
function hasNativePush(): boolean {
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
      void recordDevice(token.value).catch((error: unknown) =>
        console.error('[Push] Could not record the device:', error)
      );
    });
    await PushNotifications.addListener('registrationError', (error) => {
      console.error('[Push] APNs registration failed:', error.error);
    });
  })().catch((error: unknown) => {
    // A failed setup must not stay cached: the next start tries again.
    listening = null;
    throw error;
  });
  return listening;
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
