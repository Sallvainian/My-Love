/**
 * The two Daily Question RPCs: the arguments they send (AD-2), the zod parse of
 * the AD-16 snapshot, and the failure convention (offline refusal before any
 * request, an error or a bad shape throws).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setOnline } from '../../../tests/unit/stores/navigatorFixtures';
import { DAY_ID, dailySnapshot, waitingSnapshot } from '../../../tests/unit/stores/dailyQuestionFixture';

const rpc = vi.fn();
const abortSignal = vi.fn();

vi.mock('../supabaseClient', () => ({
  supabase: {
    rpc: (...args: unknown[]) => ({
      abortSignal: (signal: unknown) => {
        abortSignal(signal);
        return rpc(...args);
      },
    }),
  },
}));

import { AccountDataError } from '../../services/accountDataError';
import { fetchDailyDay, submitDailyPick } from '../dailyQuestionApi';

const ZONE = 'America/New_York';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  setOnline(true);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-05T15:45:00.000Z'));
  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
    () => ({ resolvedOptions: () => ({ timeZone: ZONE }) }) as unknown as Intl.DateTimeFormat
  );
  vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(300);
});

afterEach(() => {
  vi.useRealTimers();
  setOnline(true);
  rpc.mockReset();
  abortSignal.mockReset();
});

describe('fetchDailyDay', () => {
  it('sends the zone pair with an east-positive offset and the report instant', async () => {
    rpc.mockResolvedValue({ data: { status: 'ok', snapshot: dailySnapshot() }, error: null });

    await fetchDailyDay();

    expect(rpc).toHaveBeenCalledWith('get_daily_day', {
      time_zone: ZONE,
      utc_offset_minutes: -300,
      reported_at: '2026-11-05T15:45:00.000Z',
    });
  });

  it('bounds the request with a timeout signal', async () => {
    rpc.mockResolvedValue({ data: { status: 'unlinked' }, error: null });

    await fetchDailyDay();

    expect(abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it('returns an ok answer with its snapshot', async () => {
    const snapshot = waitingSnapshot('that');
    rpc.mockResolvedValue({ data: { status: 'ok', snapshot }, error: null });

    await expect(fetchDailyDay()).resolves.toEqual({ status: 'ok', snapshot });
  });

  it('returns an unlinked answer', async () => {
    rpc.mockResolvedValue({ data: { status: 'unlinked' }, error: null });

    await expect(fetchDailyDay()).resolves.toEqual({ status: 'unlinked' });
  });

  it('throws on an RPC error instead of answering unlinked', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom', code: 'XX000', details: '', hint: '' } });

    await expect(fetchDailyDay()).rejects.toBeInstanceOf(AccountDataError);
  });

  it.each([
    ['null', null],
    ['an unknown status', { status: 'pending' }],
    ['an ok answer with no snapshot', { status: 'ok' }],
    ['a snapshot with an unknown state', { status: 'ok', snapshot: { ...dailySnapshot(), state: 'x' } }],
    ['a snapshot with no question', { status: 'ok', snapshot: { ...dailySnapshot(), question: null } }],
  ])('throws on %s', async (_label, data) => {
    rpc.mockResolvedValue({ data, error: null });

    await expect(fetchDailyDay()).rejects.toMatchObject({ code: 'invalid-response' });
  });

  it('refuses offline before any request', async () => {
    setOnline(false);

    await expect(fetchDailyDay()).rejects.toMatchObject({
      code: 'offline',
      message: "You are offline. Today's question needs a connection to load.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('submitDailyPick', () => {
  it('sends the day, the choice, the instant of the pick and the zone pair', async () => {
    rpc.mockResolvedValue({ data: waitingSnapshot('this'), error: null });

    await submitDailyPick(DAY_ID, 'this', new Date('2026-11-05T15:44:00.000Z'));

    expect(rpc).toHaveBeenCalledWith('submit_daily_pick', {
      day_id: DAY_ID,
      choice: 'this',
      picked_at: '2026-11-05T15:44:00.000Z',
      time_zone: ZONE,
      utc_offset_minutes: -300,
    });
  });

  it('bounds the request with a timeout signal', async () => {
    rpc.mockResolvedValue({ data: waitingSnapshot('this'), error: null });

    await submitDailyPick(DAY_ID, 'this');

    expect(abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it('sends the offset in force at the pick instant, not at send time', async () => {
    rpc.mockResolvedValue({ data: waitingSnapshot('this'), error: null });
    const pickedAt = new Date('2026-11-01T05:30:00.000Z');
    // The device's offset has changed since the pick (a DST change): only the
    // pick instant's own offset may be sent.
    vi.spyOn(pickedAt, 'getTimezoneOffset').mockReturnValue(240);

    await submitDailyPick(DAY_ID, 'this', pickedAt);

    expect(rpc).toHaveBeenCalledWith(
      'submit_daily_pick',
      expect.objectContaining({ time_zone: ZONE, utc_offset_minutes: -240 })
    );
  });

  it('defaults the pick instant to now', async () => {
    rpc.mockResolvedValue({ data: waitingSnapshot('that'), error: null });

    await submitDailyPick(DAY_ID, 'that');

    expect(rpc).toHaveBeenCalledWith(
      'submit_daily_pick',
      expect.objectContaining({ picked_at: '2026-11-05T15:45:00.000Z' })
    );
  });

  it('returns the parsed snapshot', async () => {
    const snapshot = waitingSnapshot('this');
    rpc.mockResolvedValue({ data: snapshot, error: null });

    await expect(submitDailyPick(DAY_ID, 'this')).resolves.toEqual(snapshot);
  });

  it('throws on an answer that is not a snapshot', async () => {
    rpc.mockResolvedValue({ data: { status: 'unlinked' }, error: null });

    await expect(submitDailyPick(DAY_ID, 'this')).rejects.toMatchObject({
      code: 'invalid-response',
    });
  });

  it('throws on an RPC error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom', code: 'XX000', details: '', hint: '' } });

    await expect(submitDailyPick(DAY_ID, 'this')).rejects.toBeInstanceOf(AccountDataError);
  });

  it('refuses offline before any request', async () => {
    setOnline(false);

    await expect(submitDailyPick(DAY_ID, 'this')).rejects.toMatchObject({
      code: 'offline',
      message: 'You are offline. Your pick needs a connection to send.',
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});
