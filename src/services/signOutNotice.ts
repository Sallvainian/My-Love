/**
 * A one-line notice handed from the screen that signed the person out to the
 * login screen they land on.
 *
 * Settings unmounts the moment SIGNED_OUT lands (App renders the login screen
 * when there is no session), often before `signOut` resolves, so Settings can
 * only tell the person on the screen they arrive at: it publishes the text
 * here and the login screen subscribes. A subscription, not a mount-time
 * read, because a notice set after the login screen mounted would be missed.
 *
 * Device UI state, not account data: held in memory only, never persisted and
 * not part of `signedOutState()`, so a reload drops it.
 */

let notice: string | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of [...listeners]) listener();
}

export function showSignOutNotice(text: string): void {
  if (notice === text) return;
  notice = text;
  emit();
}

export function clearSignOutNotice(): void {
  if (notice === null) return;
  notice = null;
  emit();
}

export function subscribeSignOutNotice(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSignOutNotice(): string | null {
  return notice;
}
