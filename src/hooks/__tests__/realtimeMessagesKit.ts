// src/hooks/__tests__/realtimeMessagesKit.ts
import { expect, vi, type Mock } from 'vitest';

export const USER_ID = '11111111-1111-4111-8111-111111111111';
export const PARTNER_ID = '22222222-2222-4222-8222-222222222222';
export const OUTSIDER_ID = '33333333-3333-4333-8333-333333333333';

type SubscribeCallback = (status: string, err?: Error) => void;

/**
 * Fires a channel status through the hook's own subscribe callback. Asserts the
 * callback was registered first: an optional-chained call would silently do
 * nothing if the hook stopped subscribing, and the test would still pass.
 */
export function emitStatus(
  callback: SubscribeCallback | null | undefined,
  ...args: [status: string, err?: Error]
) {
  expect(callback).toBeTypeOf('function');
  callback!(...args);
}

/** A well-formed note from the partner to this user, as the server row looks. */
export function validNote(overrides: Record<string, unknown> = {}) {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    from_user_id: PARTNER_ID,
    to_user_id: USER_ID,
    content: 'Hello!',
    created_at: '2024-01-01T10:00:00Z',
    ...overrides,
  };
}

/**
 * The channel a parked setup would have claimed, had it got that far.
 *
 * `supabase.channel()` registers synchronously and the SDK hands the topic
 * back to anyone who asks until its leave has landed, so a channel created
 * before the awaits and abandoned by a cleanup mid-flight is a private topic
 * the hook can no longer release — `channelRef.current` is null by then.
 * The hook therefore creates nothing until every await has returned and
 * `cancelled` has been re-checked, which is what the unmount-during-setup
 * cases in `useRealtimeMessages.test.ts` pin.
 */
export function parkedChannel(): { on: Mock; subscribe: Mock } {
  return { on: vi.fn().mockReturnThis(), subscribe: vi.fn() };
}
