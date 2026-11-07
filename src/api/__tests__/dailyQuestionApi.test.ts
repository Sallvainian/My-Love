/**
 * The Daily Question RPCs: the arguments they send (AD-2), the zod parse of
 * the AD-16 snapshot, and the failure convention (offline refusal before any
 * request, an error or a bad shape throws); and the `daily_pick` announcement
 * (AD-11): who it goes to, and that it carries a day id and nothing else.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setOnline } from '../../../tests/unit/stores/navigatorFixtures';
import { DAY_ID, dailySnapshot, waitingSnapshot } from '../../../tests/unit/stores/dailyQuestionFixture';

const rpc = vi.fn();
const abortSignal = vi.fn();
const getPartnerId = vi.fn();
const sendEphemeralBroadcast = vi.fn();

vi.mock('../supabaseClient', () => ({
  supabase: {
    rpc: (...args: unknown[]) => ({
      abortSignal: (signal: unknown) => {
        abortSignal(signal);
        return rpc(...args);
      },
    }),
  },
  getPartnerId: (...args: unknown[]) => getPartnerId(...args),
}));

vi.mock('../ephemeralBroadcast', () => ({
  sendEphemeralBroadcast: (...args: unknown[]) => sendEphemeralBroadcast(...args),
}));

import { AccountDataError } from '../../services/accountDataError';
import {
  DAY_CHANGED_MESSAGE,
  announceDailyPick,
  fetchDailyDay,
  fetchDailyDayById,
  isPickRefusal,
  pickZone,
  submitDailyPick,
  submitWrittenQuestion,
} from '../dailyQuestionApi';

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
  getPartnerId.mockReset();
  sendEphemeralBroadcast.mockReset();
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

describe('fetchDailyDayById', () => {
  it('sends the day id and nothing else', async () => {
    rpc.mockResolvedValue({ data: waitingSnapshot('that'), error: null });

    await fetchDailyDayById(DAY_ID);

    expect(rpc).toHaveBeenCalledWith('get_daily_day_by_id', { day_id: DAY_ID });
  });

  it('bounds the request with a timeout signal', async () => {
    rpc.mockResolvedValue({ data: dailySnapshot(), error: null });

    await fetchDailyDayById(DAY_ID);

    expect(abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it('returns the parsed snapshot', async () => {
    const snapshot = waitingSnapshot('that');
    rpc.mockResolvedValue({ data: snapshot, error: null });

    await expect(fetchDailyDayById(DAY_ID)).resolves.toEqual(snapshot);
  });

  it('throws on an RPC error', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'Day not found', code: 'P0002', details: '', hint: '' },
    });

    await expect(fetchDailyDayById(DAY_ID)).rejects.toBeInstanceOf(AccountDataError);
  });

  it.each([
    ['null', null],
    ['an ok answer wrapper', { status: 'ok', snapshot: dailySnapshot() }],
    ['a snapshot with an unknown state', { ...dailySnapshot(), state: 'x' }],
    ['a snapshot with no question', { ...dailySnapshot(), question: null }],
  ])('throws on %s', async (_label, data) => {
    rpc.mockResolvedValue({ data, error: null });

    await expect(fetchDailyDayById(DAY_ID)).rejects.toMatchObject({ code: 'invalid-response' });
  });

  it('refuses offline before any request', async () => {
    setOnline(false);

    await expect(fetchDailyDayById(DAY_ID)).rejects.toMatchObject({
      code: 'offline',
      message: 'You are offline. The question needs a connection to load.',
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('announceDailyPick', () => {
  const PARTNER = '00000000-0000-4000-8000-0000000000aa';

  it('sends daily_pick with the day id alone to the partner\'s mood topic', async () => {
    getPartnerId.mockResolvedValue(PARTNER);
    sendEphemeralBroadcast.mockResolvedValue(undefined);

    await announceDailyPick(DAY_ID);

    expect(sendEphemeralBroadcast).toHaveBeenCalledTimes(1);
    expect(sendEphemeralBroadcast).toHaveBeenCalledWith(`mood-updates:${PARTNER}`, 'daily_pick', {
      day_id: DAY_ID,
    });
  });

  it('sends nothing when there is no partner', async () => {
    getPartnerId.mockResolvedValue(null);

    await expect(announceDailyPick(DAY_ID)).resolves.toBeUndefined();

    expect(sendEphemeralBroadcast).not.toHaveBeenCalled();
  });

  it('throws when the broadcast fails', async () => {
    const failure = new Error('Unauthorized');
    getPartnerId.mockResolvedValue(PARTNER);
    sendEphemeralBroadcast.mockRejectedValue(failure);

    await expect(announceDailyPick(DAY_ID)).rejects.toBe(failure);
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

  it('sends the zone pair it is given, not the device\'s', async () => {
    rpc.mockResolvedValue({ data: waitingSnapshot('this'), error: null });

    await submitDailyPick(DAY_ID, 'this', new Date('2026-11-05T04:50:00.000Z'), {
      time_zone: 'Asia/Tokyo',
      utc_offset_minutes: 540,
    });

    expect(rpc).toHaveBeenCalledWith('submit_daily_pick', {
      day_id: DAY_ID,
      choice: 'this',
      picked_at: '2026-11-05T04:50:00.000Z',
      time_zone: 'Asia/Tokyo',
      utc_offset_minutes: 540,
    });
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

  it('maps a DQ001 (the pick is not on the shown day) to day-changed with the notice text', async () => {
    const error = { message: "Pick date is not the day's date", code: 'DQ001', details: '', hint: '' };
    rpc.mockResolvedValue({ data: null, error });

    await expect(submitDailyPick(DAY_ID, 'this')).rejects.toMatchObject({
      name: 'AccountDataError',
      code: 'day-changed',
      message: DAY_CHANGED_MESSAGE,
    });
    expect(console.error).toHaveBeenCalledWith('[Supabase] DailyQuestionApi.submitDailyPick:', {
      code: 'DQ001',
      message: error.message,
      details: '',
      hint: '',
    });
  });

  it.each([
    [
      'DQ002',
      'Pick time outside the allowed window',
      "Your phone's clock looks wrong, so this pick couldn't be sent. Check Settings → General → Date & Time, then pick again.",
    ],
    [
      'P0002',
      'Day not found',
      "This question isn't available any more. Open Daily again to see today's question.",
    ],
    ['22023', 'Invalid choice', "This pick couldn't be sent. Please pick again."],
  ])('maps a %s refusal to a refused error with its own sentence', async (code, serverMessage, shown) => {
    const error = { message: serverMessage, code, details: '', hint: '' };
    rpc.mockResolvedValue({ data: null, error });

    const failure = await submitDailyPick(DAY_ID, 'this').catch((caught: unknown) => caught);

    expect(failure).toBeInstanceOf(AccountDataError);
    expect(failure).toMatchObject({ code: 'refused', message: shown });
    expect((failure as AccountDataError).message).not.toBe(DAY_CHANGED_MESSAGE);
    expect((failure as AccountDataError).cause).toBe(error);
    expect(console.error).toHaveBeenCalledWith('[Supabase] DailyQuestionApi.submitDailyPick:', {
      code,
      message: serverMessage,
      details: '',
      hint: '',
    });
  });

  it('leaves any other RPC error a transport error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom', code: 'XX000', details: '', hint: '' } });

    await expect(submitDailyPick(DAY_ID, 'this')).rejects.toMatchObject({ code: 'transport' });
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

describe('submitWrittenQuestion', () => {
  const refusal = (code: string, message: string) => ({
    data: null,
    error: { message, code, details: '', hint: '' },
  });

  it('calls submit_written_question with the day and the texts as typed', async () => {
    const snapshot = dailySnapshot({ write: { mine: true, done: true } });
    rpc.mockResolvedValue({ data: snapshot, error: null });

    await expect(submitWrittenQuestion(DAY_ID, ' Beach ', 'Mountains')).resolves.toEqual(snapshot);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('submit_written_question', {
      day_id: DAY_ID,
      this_text: ' Beach ',
      that_text: 'Mountains',
    });
  });

  it('bounds the request with a timeout signal', async () => {
    rpc.mockResolvedValue({ data: dailySnapshot(), error: null });

    await submitWrittenQuestion(DAY_ID, 'a', 'b');

    expect(abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it('throws on an answer that is not a snapshot', async () => {
    rpc.mockResolvedValue({ data: { nope: true }, error: null });

    await expect(submitWrittenQuestion(DAY_ID, 'a', 'b')).rejects.toMatchObject({
      code: 'invalid-response',
    });
  });

  it('refuses offline before any request', async () => {
    setOnline(false);

    await expect(submitWrittenQuestion(DAY_ID, 'a', 'b')).rejects.toMatchObject({
      code: 'offline',
      message: "You are offline. Tomorrow's question needs a connection to send.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    [
      'DQ004',
      'Not the writer for this day',
      "It is your partner's turn to write tomorrow's question.",
    ],
    ['DQ005', 'Pick before writing', "Send your own pick before writing tomorrow's question."],
    [
      'DQ006',
      'The turn ended with its date',
      "Today's turn to write has ended. Tomorrow's question will come from the pool.",
    ],
  ])('maps %s to a refused error with its own sentence', async (code, serverMessage, shown) => {
    rpc.mockResolvedValue(refusal(code, serverMessage));

    const failure = await submitWrittenQuestion(DAY_ID, 'a', 'b').catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(AccountDataError);
    expect(failure).toMatchObject({ code: 'refused', message: shown });
  });

  it("shows a DQ003's own server message", async () => {
    rpc.mockResolvedValue(refusal('DQ003', 'The two options must differ'));

    await expect(submitWrittenQuestion(DAY_ID, 'Tea', 'tea')).rejects.toMatchObject({
      name: 'AccountDataError',
      code: 'refused',
      message: 'The two options must differ',
    });
  });

  it('keeps the server error as the cause of a refusal', async () => {
    rpc.mockResolvedValue(refusal('DQ004', 'Not the writer for this day'));

    const failure = (await submitWrittenQuestion(DAY_ID, 'a', 'b').catch(
      (error: unknown) => error
    )) as AccountDataError;

    expect(failure.cause).toMatchObject({ code: 'DQ004' });
  });

  it('leaves any other error a transport error', async () => {
    rpc.mockResolvedValue(refusal('XX000', 'boom'));

    await expect(submitWrittenQuestion(DAY_ID, 'a', 'b')).rejects.toMatchObject({
      code: 'transport',
    });
  });

  it('leaves a network failure a transport error', async () => {
    rpc.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(submitWrittenQuestion(DAY_ID, 'a', 'b')).rejects.toMatchObject({
      code: 'transport',
    });
  });
});

describe('pickZone', () => {
  it('is the device zone name with the offset in force at the given instant', () => {
    const at = new Date('2026-11-01T05:30:00.000Z');
    vi.spyOn(at, 'getTimezoneOffset').mockReturnValue(240);

    expect(pickZone(at)).toEqual({ time_zone: ZONE, utc_offset_minutes: -240 });
  });
});

describe('isPickRefusal', () => {
  async function failureOf(error: unknown): Promise<unknown> {
    rpc.mockResolvedValue({ data: null, error });
    return submitDailyPick(DAY_ID, 'this').catch((caught: unknown) => caught);
  }

  it.each(['DQ001', 'DQ002', 'P0002', '22023'])('is true for the RPC refusal %s', async (code) => {
    expect(isPickRefusal(await failureOf({ message: 'refused', code, details: '', hint: '' }))).toBe(true);
  });

  it('is true for day-changed', () => {
    expect(isPickRefusal(new AccountDataError('day-changed', DAY_CHANGED_MESSAGE))).toBe(true);
  });

  it.each(['XX000', '57014', '42501', 'PGRST301'])('is false for the other SQLSTATE %s', async (code) => {
    expect(isPickRefusal(await failureOf({ message: 'other', code, details: '', hint: '' }))).toBe(false);
  });

  it('is false for offline, a network failure, a timeout and an unparsed answer', async () => {
    expect(isPickRefusal(new AccountDataError('offline', 'You are offline.'))).toBe(false);

    rpc.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(isPickRefusal(await submitDailyPick(DAY_ID, 'this').catch((e: unknown) => e))).toBe(false);

    rpc.mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError'));
    expect(isPickRefusal(await submitDailyPick(DAY_ID, 'this').catch((e: unknown) => e))).toBe(false);

    rpc.mockResolvedValue({ data: { status: 'unlinked' }, error: null });
    const unparsed = await submitDailyPick(DAY_ID, 'this').catch((e: unknown) => e);
    expect(unparsed).toMatchObject({ code: 'invalid-response' });
    expect(isPickRefusal(unparsed)).toBe(false);
  });

  it('is false for anything that is not an AccountDataError', () => {
    expect(isPickRefusal(new Error('P0002'))).toBe(false);
    expect(isPickRefusal({ code: 'DQ002' })).toBe(false);
    expect(isPickRefusal(null)).toBe(false);
  });
});
