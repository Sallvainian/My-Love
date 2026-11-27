import { assertEquals, assertFalse } from 'jsr:@std/assert@1';

import type { ApnsClient } from './apns.ts';
import {
  handleSendPush,
  secretsMatch,
  type CoupleDayRow,
  type DailyNudgeRow,
  type DailyPickRow,
  type DailyReminderRow,
  type DateRow,
  type DeviceRow,
  type InteractionRow,
  type MoodRow,
  type NoteRow,
  PREFERENCE_FOR_KIND,
  type PartnerRequestRow,
  type PhotoRow,
  type PushDb,
  type PushKind,
  type PushPreference,
  type PushRequestRow,
} from './handler.ts';

const NOTE_ID = '11111111-1111-4111-8111-111111111111';
const MOOD_ID = '22222222-2222-4222-8222-222222222222';
const PHOTO_ID = '33333333-3333-4333-8333-333333333333';
const INTERACTION_ID = '44444444-4444-4444-8444-444444444444';
/** The id story 3.5's trigger posted under the `date` kind, which is gone. */
const OLD_DATE_CHANGE_ID = '55555555-5555-4555-8555-555555555555';
const PARTNER_REQUEST_ID = '66666666-6666-4666-8666-666666666666';
const EVENT_ID = '77777777-7777-4777-8777-777777777777';
const ANNIVERSARY_ID = '88888888-8888-4888-8888-888888888888';
const DAILY_PICK_ID = '99999999-9999-4999-8999-999999999999';
const DAILY_NUDGE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DAILY_REMINDER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const COUPLE_DAY_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const SECRET = 'a-shared-secret-for-tests';

const textNote: NoteRow = {
  id: NOTE_ID,
  from_user_id: 'sender',
  to_user_id: 'recipient',
  content: 'Thinking of you',
  image_url: null,
};

const happyGrateful: MoodRow = {
  id: MOOD_ID,
  user_id: 'sender',
  mood_type: 'happy',
  mood_types: ['happy', 'grateful'],
};
const photo: PhotoRow = { id: PHOTO_ID, user_id: 'sender' };
/** Asked by `sender` (Casey) of `recipient`; the fake lists devices only for `recipient`. */
const pendingRequest: PartnerRequestRow = {
  id: PARTNER_REQUEST_ID,
  from_user_id: 'sender',
  to_user_id: 'recipient',
  status: 'pending',
};
/** Asked by `recipient`, accepted by `sender`: the acceptance goes to `recipient`. */
const acceptedRequest: PartnerRequestRow = {
  id: PARTNER_REQUEST_ID,
  from_user_id: 'recipient',
  to_user_id: 'sender',
  status: 'accepted',
};
const poke: InteractionRow = { id: INTERACTION_ID, from_user_id: 'sender', to_user_id: 'recipient', type: 'poke' };
const event: DateRow = { id: EVENT_ID, user_id: 'sender', label: 'Paris trip' };
const anniversary: DateRow = { id: ANNIVERSARY_ID, user_id: 'sender', label: 'First date' };

/** The pair's day: `recipient` and `sender` are the two seats (the fake does not check their order). */
const coupleDay: CoupleDayRow = {
  id: COUPLE_DAY_ID,
  user_a: 'recipient',
  user_b: 'sender',
};
/** `sender` picked first: a first pick pushes nobody; the other seat is `recipient`. */
const firstPick: DailyPickRow = { id: DAILY_PICK_ID, day_id: COUPLE_DAY_ID, user_id: 'sender', is_second: false };
/** `sender` picked second (`daily_both_answered`). */
const secondPick: DailyPickRow = { ...firstPick, is_second: true };
/** From `sender` to `recipient`. */
const dailyNudge: DailyNudgeRow = {
  id: DAILY_NUDGE_ID,
  from_user: 'sender',
  to_user: 'recipient',
  day_id: COUPLE_DAY_ID,
  held: false,
  released_at: null,
};
/** For `recipient`, whose partner is `sender` (these rows are used with `partnerId: 'sender'`). */
const eveningSelf: DailyReminderRow = {
  id: DAILY_REMINDER_ID,
  user_id: 'recipient',
  kind: 'evening_self',
  day_id: COUPLE_DAY_ID,
};
/** Reminders of the kinds story 11.2's migration deletes; a row of either that is still read is no push. */
const morningReminder: DailyReminderRow = { ...eveningSelf, kind: 'morning' };
const eveningPartner: DailyReminderRow = { ...eveningSelf, kind: 'evening_partner' };

function fakeDb(options: {
  dailyPick?: DailyPickRow | null;
  dailyNudge?: DailyNudgeRow | null;
  dailyReminder?: DailyReminderRow | null;
  coupleDay?: CoupleDayRow | null;
  /**
   * What `user_local_date` and `couple_streak` would answer, given to the fake as methods that are
   * not on `PushDb` any more: the sender reads neither, and `legacyReads` records any call.
   */
  localDate?: string;
  streak?: { held: number; run: number };
  /** Every call to either method `PushDb` no longer has. */
  legacyReads?: string[];
  /** Every `getCoupleDay` call's day id. */
  dayLookups?: string[];
  note?: NoteRow | null;
  mood?: MoodRow | null;
  photo?: PhotoRow | null;
  interaction?: InteractionRow | null;
  partnerRequest?: PartnerRequestRow | null;
  event?: DateRow | null;
  anniversary?: DateRow | null;
  /** The display name of every account; defaults to Casey for `sender` and Jessie for the rest. */
  displayName?: string | null;
  /** The user ids whose devices were listed. */
  listed?: string[];
  /** The owner's partner; defaults to the recipient. `null` is an unlinked owner. */
  partnerId?: string | null;
  partnerLookups?: string[];
  devices?: DeviceRow[];
  secret?: string | null;
  claimed?: PushRequestRow[];
  released?: string[];
  deletedGone?: [string, number][];
  failOn?: 'getNote' | 'isPushEnabled' | 'getCoupleDay';
  /** `recipient`'s switches; one not listed is on, as is every switch of an account with no row. */
  preferences?: Partial<Record<PushPreference, boolean>>;
  /** `sender`'s own switches, read only when a push goes to `sender`; the default is all on. */
  senderPreferences?: Partial<Record<PushPreference, boolean>>;
  /** The devices listed for `sender`; the default is none. */
  senderDevices?: DeviceRow[];
  /** Every switch looked up, as `[userId, preference]`. */
  preferenceLookups?: [string, PushPreference][];
  /** The recipient's unread love-note count (the badge); defaults to 0. An Error makes the read fail. */
  unreadCount?: number | Error;
  /** Every user whose unread count was looked up. */
  countLookups?: string[];
}): PushDb {
  const claimed = options.claimed ?? [];
  const note = options.note === undefined ? textNote : options.note;
  const db: PushDb = {
    getSenderSecret: () => Promise.resolve(options.secret === undefined ? SECRET : options.secret),
    getNote: () =>
      options.failOn === 'getNote' ? Promise.reject(new Error('db down')) : Promise.resolve(note),
    getMood: () => Promise.resolve(options.mood === undefined ? null : options.mood),
    getPhoto: () => Promise.resolve(options.photo === undefined ? null : options.photo),
    getInteraction: () => Promise.resolve(options.interaction === undefined ? null : options.interaction),
    getPartnerRequest: () =>
      Promise.resolve(options.partnerRequest === undefined ? null : options.partnerRequest),
    getEvent: () => Promise.resolve(options.event === undefined ? null : options.event),
    getAnniversary: () => Promise.resolve(options.anniversary === undefined ? null : options.anniversary),
    getDailyPick: () => Promise.resolve(options.dailyPick === undefined ? null : options.dailyPick),
    getDailyNudge: () => Promise.resolve(options.dailyNudge === undefined ? null : options.dailyNudge),
    getDailyReminder: () => Promise.resolve(options.dailyReminder === undefined ? null : options.dailyReminder),
    getCoupleDay: (dayId) => {
      options.dayLookups?.push(dayId);
      if (options.failOn === 'getCoupleDay') return Promise.reject(new Error('db down'));
      return Promise.resolve(options.coupleDay === undefined ? coupleDay : options.coupleDay);
    },
    getPartnerId: (userId) => {
      options.partnerLookups?.push(userId);
      return Promise.resolve(options.partnerId === undefined ? 'recipient' : options.partnerId);
    },
    isPushEnabled: (userId, preference) => {
      options.preferenceLookups?.push([userId, preference]);
      if (options.failOn === 'isPushEnabled') return Promise.reject(new Error('db down'));
      const switches = userId === 'sender' ? options.senderPreferences : options.preferences;
      return Promise.resolve(switches?.[preference] ?? true);
    },
    getDisplayName: (userId) =>
      Promise.resolve(
        options.displayName !== undefined ? options.displayName : userId === 'sender' ? 'Casey' : 'Jessie'
      ),
    listDevices: (userId) => {
      options.listed?.push(userId);
      if (userId === 'sender') return Promise.resolve(options.senderDevices ?? []);
      return Promise.resolve(userId === 'recipient' ? (options.devices ?? []) : []);
    },
    countUnreadNotes: (userId) => {
      options.countLookups?.push(userId);
      const count = options.unreadCount ?? 0;
      return count instanceof Error ? Promise.reject(count) : Promise.resolve(count);
    },
    claimRequest: (row) => {
      if (claimed.some((c) => c.kind === row.kind && c.source_id === row.source_id && c.token === row.token)) {
        return Promise.resolve(false);
      }
      claimed.push(row);
      return Promise.resolve(true);
    },
    releaseRequest: (_kind, _sourceId, token) => {
      options.released?.push(token);
      const index = claimed.findIndex((c) => c.token === token);
      if (index >= 0) claimed.splice(index, 1);
      return Promise.resolve();
    },
    deleteGoneDevice: (token, goneAt) => {
      options.deletedGone?.push([token, goneAt]);
      return Promise.resolve();
    },
  };
  // The two reads the sender used to make are no longer on `PushDb`; a fake that still has them
  // shows that nothing calls them (`legacyReads` stays empty).
  return Object.assign(db, {
    getUserLocalDate: (userId: string, atIso: string) => {
      options.legacyReads?.push(`getUserLocalDate ${userId} ${atIso}`);
      return Promise.resolve(options.localDate ?? '2027-01-15');
    },
    getCoupleStreak: (userA: string, userB: string, viewer: string, atIso: string) => {
      options.legacyReads?.push(`getCoupleStreak ${userA} ${userB} ${viewer} ${atIso}`);
      return Promise.resolve(options.streak ?? { held: 0, run: 0 });
    },
  });
}

function request(body: unknown, headers: Record<string, string> = { 'x-push-secret': SECRET }): Request {
  return new Request('http://sender.test/send-push', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

/** The tests' fixed clock; a handler without a `now` override runs on the real one. */
const NOW = 1800000000000;
const DAY_MS = 86_400_000;
/** Far in the future, so it is fresh on the real clock and on `now: () => NOW`, whenever the tests run. */
const FRESH = '2100-01-01T00:00:00.000Z';
/** 31 days before NOW: older than the 30-day limit. */
const STALE = new Date(NOW - 31 * DAY_MS).toISOString();

const TWO_DEVICES: DeviceRow[] = [
  { token: 'tok-a', environment: 'sandbox', updated_at: FRESH },
  { token: 'tok-b', environment: 'production', updated_at: FRESH },
];

Deno.test('unconfigured: every device gets a recorded request and nothing is sent', async () => {
  const claimed: PushRequestRow[] = [];
  const response = await handleSendPush(request({ note_id: NOTE_ID }), {
    db: fakeDb({ devices: TWO_DEVICES, claimed }),
    apns: null,
  });
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { sent: 0, recorded: 2, skipped: 0, failed: 0, gone: 0 });
  assertEquals(claimed.map((c) => [c.token, c.environment, c.delivery]), [
    ['tok-a', 'sandbox', 'recorded'],
    ['tok-b', 'production', 'recorded'],
  ]);
  assertEquals(claimed[0].payload, {
    kind: 'love_note',
    aps: { alert: { title: 'Casey', body: 'Thinking of you' }, 'thread-id': 'love-notes', badge: 0 },
  });
});

Deno.test('a picture-only note records the picture body', async () => {
  const claimed: PushRequestRow[] = [];
  await handleSendPush(request({ note_id: NOTE_ID }), {
    db: fakeDb({
      note: { ...textNote, content: ' ', image_url: 'x/pic.jpg' },
      devices: [TWO_DEVICES[0]],
      claimed,
    }),
    apns: null,
  });
  assertEquals(claimed[0].payload.aps.alert.body, 'Sent you a picture');
});

Deno.test('a repeated call for the same note records nothing new', async () => {
  const claimed: PushRequestRow[] = [];
  const deps = { db: fakeDb({ devices: TWO_DEVICES, claimed }), apns: null };
  await handleSendPush(request({ note_id: NOTE_ID }), deps);
  const second = await handleSendPush(request({ note_id: NOTE_ID }), deps);
  assertEquals(await second.json(), { sent: 0, recorded: 0, skipped: 2, failed: 0, gone: 0 });
  assertEquals(claimed.length, 2);
});

Deno.test('configured: each device is sent to with its own environment', async () => {
  const sends: [string, string][] = [];
  const apns: ApnsClient = {
    send: (token, environment) => {
      sends.push([token, environment]);
      return Promise.resolve({ ok: true, status: 200, reason: null, timestamp: null });
    },
  };
  const claimed: PushRequestRow[] = [];
  const response = await handleSendPush(request({ note_id: NOTE_ID }), {
    db: fakeDb({ devices: TWO_DEVICES, claimed }),
    apns,
  });
  assertEquals(await response.json(), { sent: 2, recorded: 0, skipped: 0, failed: 0, gone: 0 });
  assertEquals(sends, [
    ['tok-a', 'sandbox'],
    ['tok-b', 'production'],
  ]);
  assertEquals(claimed.map((c) => c.delivery), ['sent', 'sent']);
});

Deno.test('a refused send releases its claim so a retry can send it', async () => {
  const released: string[] = [];
  const apns: ApnsClient = {
    send: () => Promise.resolve({ ok: false, status: 400, reason: 'BadDeviceToken', timestamp: null }),
  };
  const claimed: PushRequestRow[] = [];
  const response = await handleSendPush(request({ note_id: NOTE_ID }), {
    db: fakeDb({ devices: [TWO_DEVICES[0]], claimed, released }),
    apns,
  });
  assertEquals(await response.json(), { sent: 0, recorded: 0, skipped: 0, failed: 1, gone: 0 });
  assertEquals(released, ['tok-a']);
  assertEquals(claimed.length, 0);
});

Deno.test('a recipient with no devices sends nothing', async () => {
  const response = await handleSendPush(request({ note_id: NOTE_ID }), {
    db: fakeDb({ devices: [] }),
    apns: null,
  });
  assertEquals(await response.json(), { sent: 0, recorded: 0, skipped: 0, failed: 0, gone: 0 });
});

Deno.test('a missing, wrong or unset secret is refused before anything is read', async () => {
  for (const [headers, secret] of [
    [{}, SECRET],
    [{ 'x-push-secret': 'wrong' }, SECRET],
    [{ 'x-push-secret': SECRET }, null],
  ] as const) {
    const response = await handleSendPush(request({ note_id: NOTE_ID }, { ...headers }), {
      db: fakeDb({ devices: TWO_DEVICES, secret, failOn: 'getNote' }),
      apns: null,
    });
    assertEquals(response.status, 401);
    await response.body?.cancel();
  }
});

Deno.test('bad requests: method, body, id, unknown note, database failure', async () => {
  const deps = { db: fakeDb({}), apns: null };
  const get = await handleSendPush(new Request('http://x/', { method: 'GET' }), deps);
  assertEquals(get.status, 405);
  await get.body?.cancel();

  for (const [body, status] of [
    ['not json', 400],
    [{ note_id: 'nope' }, 400],
    [{}, 400],
  ] as const) {
    const response = await handleSendPush(request(body), deps);
    assertEquals(response.status, status);
    await response.body?.cancel();
  }

  const missing = await handleSendPush(request({ note_id: NOTE_ID }), { db: fakeDb({ note: null }), apns: null });
  assertEquals(missing.status, 404);
  await missing.body?.cancel();

  const down = await handleSendPush(request({ note_id: NOTE_ID }), { db: fakeDb({ failOn: 'getNote' }), apns: null });
  assertEquals(down.status, 500);
  await down.body?.cancel();
});

Deno.test('secretsMatch compares whole strings', () => {
  assertEquals(secretsMatch('abc', 'abc'), true);
  assertEquals(secretsMatch('abc', 'abd'), false);
  assertEquals(secretsMatch('abc', 'abcd'), false);
  assertEquals(secretsMatch('', 'abc'), false);
});

Deno.test('one device\'s APNs rejection fails only that device', async () => {
  const released: string[] = [];
  const apns: ApnsClient = {
    send: (token) =>
      token === 'tok-a'
        ? Promise.reject(new Error('network'))
        : Promise.resolve({ ok: true, status: 200, reason: null, timestamp: null }),
  };
  const claimed: PushRequestRow[] = [];
  const response = await handleSendPush(request({ note_id: NOTE_ID }), {
    db: fakeDb({ devices: TWO_DEVICES, claimed, released }),
    apns,
  });
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { sent: 1, recorded: 0, skipped: 0, failed: 1, gone: 0 });
  assertEquals(released, ['tok-a']);
  assertEquals(claimed.map((c) => c.token), ['tok-b']);
});

Deno.test('a failing release does not turn the answer into a 500', async () => {
  const apns: ApnsClient = {
    send: (token) =>
      Promise.resolve(
        token === 'tok-a'
          ? { ok: false, status: 400, reason: 'BadDeviceToken', timestamp: null }
          : { ok: true, status: 200, reason: null, timestamp: null }
      ),
  };
  const db = fakeDb({ devices: TWO_DEVICES });
  db.releaseRequest = () => Promise.reject(new Error('db down'));
  const response = await handleSendPush(request({ note_id: NOTE_ID }), { db, apns });
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { sent: 1, recorded: 0, skipped: 0, failed: 1, gone: 0 });
});

Deno.test('a failing claim fails that device and keeps the others', async () => {
  const db = fakeDb({ devices: TWO_DEVICES });
  const claim = db.claimRequest;
  db.claimRequest = (row) =>
    row.token === 'tok-a' ? Promise.reject(new Error('db down')) : claim(row);
  const response = await handleSendPush(request({ note_id: NOTE_ID }), { db, apns: null });
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { sent: 0, recorded: 1, skipped: 0, failed: 1, gone: 0 });
});

Deno.test('a declared body over the limit is refused with 413', async () => {
  const response = await handleSendPush(
    request({ note_id: NOTE_ID }, { 'x-push-secret': SECRET, 'content-length': '2000' }),
    { db: fakeDb({ devices: TWO_DEVICES }), apns: null }
  );
  assertEquals(response.status, 413);
  await response.body?.cancel();
});

Deno.test('a 410 deletes that registration, sends the others and counts it gone', async () => {
  const released: string[] = [];
  const deletedGone: [string, number][] = [];
  const apns: ApnsClient = {
    send: (token) =>
      Promise.resolve(
        token === 'tok-a'
          ? { ok: false, status: 410, reason: 'Unregistered', timestamp: 1700000000000 }
          : { ok: true, status: 200, reason: null, timestamp: null }
      ),
  };
  const claimed: PushRequestRow[] = [];
  const response = await handleSendPush(request({ note_id: NOTE_ID }), {
    db: fakeDb({ devices: TWO_DEVICES, claimed, released, deletedGone }),
    apns,
    now: () => NOW,
  });
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { sent: 1, recorded: 0, skipped: 0, failed: 0, gone: 1 });
  // Deleted only if not registered again after APNs's timestamp.
  assertEquals(deletedGone, [['tok-a', 1700000000000]]);
  assertEquals(released, ['tok-a']);
  assertEquals(claimed.map((c) => c.token), ['tok-b']);
});

Deno.test('a 410 with no timestamp keeps a registration made after the send started', async () => {
  const deletedGone: [string, number][] = [];
  const apns: ApnsClient = {
    send: () => Promise.resolve({ ok: false, status: 410, reason: 'Unregistered', timestamp: null }),
  };
  const response = await handleSendPush(request({ note_id: NOTE_ID }), {
    db: fakeDb({ devices: [TWO_DEVICES[0]], deletedGone }),
    apns,
    now: () => NOW,
  });
  assertEquals(await response.json(), { sent: 0, recorded: 0, skipped: 0, failed: 0, gone: 1 });
  assertEquals(deletedGone, [['tok-a', 1800000000000]]);
});

Deno.test('a 400 BadDeviceToken deletes no registration', async () => {
  const deletedGone: [string, number][] = [];
  const released: string[] = [];
  const apns: ApnsClient = {
    send: () => Promise.resolve({ ok: false, status: 400, reason: 'BadDeviceToken', timestamp: null }),
  };
  const response = await handleSendPush(request({ note_id: NOTE_ID }), {
    db: fakeDb({ devices: TWO_DEVICES, deletedGone, released }),
    apns,
  });
  assertEquals(await response.json(), { sent: 0, recorded: 0, skipped: 0, failed: 2, gone: 0 });
  assertEquals(deletedGone, []);
  assertEquals(released.sort(), ['tok-a', 'tok-b']);
});

Deno.test('a failed delete of a gone registration is counted failed', async () => {
  const errors: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => void errors.push(args);
  try {
    const apns: ApnsClient = {
      send: (token) =>
        Promise.resolve(
          token === 'tok-a'
            ? { ok: false, status: 410, reason: 'Unregistered', timestamp: 1700000000000 }
            : { ok: true, status: 200, reason: null, timestamp: null }
        ),
    };
    const db = fakeDb({ devices: TWO_DEVICES });
    db.deleteGoneDevice = () => Promise.reject(new Error('db down'));
    const response = await handleSendPush(request({ note_id: NOTE_ID }), { db, apns });
    assertEquals(response.status, 200);
    assertEquals(await response.json(), { sent: 1, recorded: 0, skipped: 0, failed: 1, gone: 0 });
    assertEquals(errors.length, 1);
  } finally {
    console.error = original;
  }
});

Deno.test('a failing release on a 410 still deletes the registration (counted failed)', async () => {
  const original = console.error;
  console.error = () => {};
  try {
    const deletedGone: [string, number][] = [];
    const apns: ApnsClient = {
      send: () => Promise.resolve({ ok: false, status: 410, reason: 'Unregistered', timestamp: 1700000000000 }),
    };
    const db = fakeDb({ devices: [TWO_DEVICES[0]], deletedGone });
    db.releaseRequest = () => Promise.reject(new Error('db down'));
    const response = await handleSendPush(request({ note_id: NOTE_ID }), { db, apns });
    assertEquals(response.status, 200);
    assertEquals(await response.json(), { sent: 0, recorded: 0, skipped: 0, failed: 1, gone: 0 });
    assertEquals(deletedGone, [['tok-a', 1700000000000]]);
  } finally {
    console.error = original;
  }
});

Deno.test('a stale registration is neither claimed nor sent, is deleted at now minus 30 days and counts gone', async () => {
  const sends: string[] = [];
  const apns: ApnsClient = {
    send: (token) => {
      sends.push(token);
      return Promise.resolve({ ok: true, status: 200, reason: null, timestamp: null });
    },
  };
  const claimed: PushRequestRow[] = [];
  const deletedGone: [string, number][] = [];
  const response = await handleSendPush(request({ note_id: NOTE_ID }), {
    db: fakeDb({
      devices: [
        { token: 'tok-old', environment: 'sandbox', updated_at: STALE },
        { token: 'tok-new', environment: 'sandbox', updated_at: FRESH },
      ],
      claimed,
      deletedGone,
    }),
    apns,
    now: () => NOW,
  });
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { sent: 1, recorded: 0, skipped: 0, failed: 0, gone: 1 });
  assertEquals(sends, ['tok-new']);
  assertEquals(claimed.map((c) => c.token), ['tok-new']);
  assertEquals(deletedGone, [['tok-old', NOW - 30 * DAY_MS]]);
});

Deno.test('a stale registration is pruned when nothing is sent too (recorded path)', async () => {
  const claimed: PushRequestRow[] = [];
  const deletedGone: [string, number][] = [];
  const response = await handleSendPush(request({ note_id: NOTE_ID }), {
    db: fakeDb({
      devices: [
        { token: 'tok-old', environment: 'sandbox', updated_at: STALE },
        { token: 'tok-new', environment: 'sandbox', updated_at: FRESH },
      ],
      claimed,
      deletedGone,
    }),
    apns: null,
    now: () => NOW,
  });
  assertEquals(await response.json(), { sent: 0, recorded: 1, skipped: 0, failed: 0, gone: 1 });
  assertEquals(claimed.map((c) => c.token), ['tok-new']);
  assertEquals(deletedGone, [['tok-old', NOW - 30 * DAY_MS]]);
});

Deno.test('a registration just inside 30 days is still sent to', async () => {
  const claimed: PushRequestRow[] = [];
  const deletedGone: [string, number][] = [];
  const response = await handleSendPush(request({ note_id: NOTE_ID }), {
    db: fakeDb({
      devices: [
        { token: 'tok-edge', environment: 'sandbox', updated_at: new Date(NOW - 30 * DAY_MS + 1000).toISOString() },
      ],
      claimed,
      deletedGone,
    }),
    apns: null,
    now: () => NOW,
  });
  assertEquals(await response.json(), { sent: 0, recorded: 1, skipped: 0, failed: 0, gone: 0 });
  assertEquals(deletedGone, []);
});

Deno.test('a failed delete of a stale registration is counted failed and spares the others', async () => {
  const original = console.error;
  console.error = () => {};
  try {
    const claimed: PushRequestRow[] = [];
    const db = fakeDb({
      devices: [
        { token: 'tok-old', environment: 'sandbox', updated_at: STALE },
        { token: 'tok-new', environment: 'sandbox', updated_at: FRESH },
      ],
      claimed,
    });
    db.deleteGoneDevice = () => Promise.reject(new Error('db down'));
    const response = await handleSendPush(request({ note_id: NOTE_ID }), { db, apns: null, now: () => NOW });
    assertEquals(response.status, 200);
    assertEquals(await response.json(), { sent: 0, recorded: 1, skipped: 0, failed: 1, gone: 0 });
    assertEquals(claimed.map((c) => c.token), ['tok-new']);
  } finally {
    console.error = original;
  }
});

// ---- Story 3.4: moods, photos, pokes and kisses ----

const PARTNER_THREAD = 'partner-activity';

Deno.test('a mood records one request per partner device with the mood labels', async () => {
  const claimed: PushRequestRow[] = [];
  const response = await handleSendPush(request({ kind: 'mood', id: MOOD_ID }), {
    db: fakeDb({ mood: happyGrateful, devices: TWO_DEVICES, claimed }),
    apns: null,
  });
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { sent: 0, recorded: 2, skipped: 0, failed: 0, gone: 0 });
  assertEquals(claimed.map((c) => [c.kind, c.source_id, c.token]), [
    ['mood', MOOD_ID, 'tok-a'],
    ['mood', MOOD_ID, 'tok-b'],
  ]);
  assertEquals(claimed[0].payload, {
    kind: 'mood',
    aps: { alert: { title: 'Casey', body: 'Logged a mood: Happy, Grateful' }, 'thread-id': PARTNER_THREAD, badge: 0 },
  });
});

Deno.test('a photo, a poke and a kiss record their R7 text', async () => {
  const cases: [Record<string, unknown>, Parameters<typeof fakeDb>[0], string][] = [
    [{ kind: 'photo', id: PHOTO_ID }, { photo }, 'Added a photo'],
    [{ kind: 'interaction', id: INTERACTION_ID }, { interaction: poke }, 'Poked you'],
    [{ kind: 'interaction', id: INTERACTION_ID }, { interaction: { ...poke, type: 'kiss' } }, 'Sent you a kiss'],
  ];
  for (const [body, options, text] of cases) {
    const claimed: PushRequestRow[] = [];
    const response = await handleSendPush(request(body), {
      db: fakeDb({ ...options, devices: [TWO_DEVICES[0]], claimed }),
      apns: null,
    });
    assertEquals(await response.json(), { sent: 0, recorded: 1, skipped: 0, failed: 0, gone: 0 });
    assertEquals(claimed[0].payload, {
      kind: body.kind as string,
      aps: { alert: { title: 'Casey', body: text }, 'thread-id': PARTNER_THREAD, badge: 0 },
    });
  }
});

Deno.test('a replayed {kind, id} skips every device and records nothing new', async () => {
  const claimed: PushRequestRow[] = [];
  const deps = { db: fakeDb({ mood: happyGrateful, devices: TWO_DEVICES, claimed }), apns: null };
  await handleSendPush(request({ kind: 'mood', id: MOOD_ID }), deps);
  const second = await handleSendPush(request({ kind: 'mood', id: MOOD_ID }), deps);
  assertEquals(await second.json(), { sent: 0, recorded: 0, skipped: 2, failed: 0, gone: 0 });
  assertEquals(claimed.length, 2);
});

Deno.test('the same id under two kinds is two different claims', async () => {
  const claimed: PushRequestRow[] = [];
  const deps = {
    db: fakeDb({ mood: happyGrateful, photo: { ...photo, id: MOOD_ID }, devices: [TWO_DEVICES[0]], claimed }),
    apns: null,
  };
  await handleSendPush(request({ kind: 'mood', id: MOOD_ID }), deps);
  const second = await handleSendPush(request({ kind: 'photo', id: MOOD_ID }), deps);
  assertEquals(await second.json(), { sent: 0, recorded: 1, skipped: 0, failed: 0, gone: 0 });
});

Deno.test('an unlinked owner of a mood or photo answers zero counts and claims nothing', async () => {
  for (const [body, options] of [
    [{ kind: 'mood', id: MOOD_ID }, { mood: happyGrateful }],
    [{ kind: 'photo', id: PHOTO_ID }, { photo }],
  ] as const) {
    const claimed: PushRequestRow[] = [];
    const response = await handleSendPush(request(body), {
      db: fakeDb({ ...options, partnerId: null, devices: TWO_DEVICES, claimed }),
      apns: null,
    });
    assertEquals(response.status, 200);
    assertEquals(await response.json(), { sent: 0, recorded: 0, skipped: 0, failed: 0, gone: 0 });
    assertEquals(claimed.length, 0);
  }
});

Deno.test('a recipient equal to the sender claims nothing', async () => {
  const claimed: PushRequestRow[] = [];
  const response = await handleSendPush(request({ kind: 'mood', id: MOOD_ID }), {
    db: fakeDb({ mood: happyGrateful, partnerId: 'sender', devices: TWO_DEVICES, claimed }),
    apns: null,
  });
  assertEquals(await response.json(), { sent: 0, recorded: 0, skipped: 0, failed: 0, gone: 0 });
  assertEquals(claimed.length, 0);
});

Deno.test('an interaction type that is not a push claims nothing', async () => {
  const claimed: PushRequestRow[] = [];
  const response = await handleSendPush(request({ kind: 'interaction', id: INTERACTION_ID }), {
    db: fakeDb({ interaction: { ...poke, type: 'fart' }, devices: TWO_DEVICES, claimed }),
    apns: null,
  });
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { sent: 0, recorded: 0, skipped: 0, failed: 0, gone: 0 });
  assertEquals(claimed.length, 0);
});

Deno.test('a mood goes to the owner\'s partner, an interaction to its to_user_id', async () => {
  const lookups: string[] = [];
  const claimed: PushRequestRow[] = [];
  await handleSendPush(request({ kind: 'mood', id: MOOD_ID }), {
    db: fakeDb({ mood: happyGrateful, devices: [TWO_DEVICES[0]], claimed, partnerLookups: lookups }),
    apns: null,
  });
  assertEquals(lookups, ['sender']);

  lookups.length = 0;
  await handleSendPush(request({ kind: 'interaction', id: INTERACTION_ID }), {
    db: fakeDb({ interaction: poke, devices: [TWO_DEVICES[0]], claimed, partnerLookups: lookups }),
    apns: null,
  });
  assertEquals(lookups, []);
});

Deno.test('a failed APNs send for a mood releases its claim by kind', async () => {
  const released: string[] = [];
  const kinds: string[] = [];
  const db = fakeDb({ mood: happyGrateful, devices: [TWO_DEVICES[0]], released });
  const release = db.releaseRequest;
  db.releaseRequest = (kind, sourceId, token) => {
    kinds.push(`${kind}:${sourceId}`);
    return release(kind, sourceId, token);
  };
  const apns: ApnsClient = {
    send: () => Promise.resolve({ ok: false, status: 500, reason: 'InternalServerError', timestamp: null }),
  };
  const response = await handleSendPush(request({ kind: 'mood', id: MOOD_ID }), { db, apns });
  assertEquals(await response.json(), { sent: 0, recorded: 0, skipped: 0, failed: 1, gone: 0 });
  assertEquals(kinds, [`mood:${MOOD_ID}`]);
});

Deno.test('an unknown kind or a non-uuid id is a 400', async () => {
  const deps = { db: fakeDb({ mood: happyGrateful }), apns: null };
  for (const body of [
    { kind: 'dance', id: MOOD_ID },
    { kind: 'love_note', id: NOTE_ID },
    { kind: 'mood', id: 'nope' },
    { kind: 'mood' },
    { kind: 7, id: MOOD_ID },
    [],
    'null',
  ]) {
    const response = await handleSendPush(request(body), deps);
    assertEquals(response.status, 400, JSON.stringify(body));
    await response.body?.cancel();
  }
});

Deno.test('a valid kind with a missing row is a 404', async () => {
  for (const kind of ['mood', 'photo', 'interaction', 'partner_request', 'partner_accept', 'event', 'anniversary']) {
    const response = await handleSendPush(request({ kind, id: MOOD_ID }), { db: fakeDb({}), apns: null });
    assertEquals(response.status, 404, kind);
    await response.body?.cancel();
  }
});

Deno.test('the love-note body still works beside the new kinds', async () => {
  const claimed: PushRequestRow[] = [];
  await handleSendPush(request({ note_id: NOTE_ID }), {
    db: fakeDb({ devices: [TWO_DEVICES[0]], claimed }),
    apns: null,
  });
  assertEquals(claimed.map((c) => [c.kind, c.source_id]), [['love_note', NOTE_ID]]);
});

// ---- Story 5.4: date changes no longer push; 2026-11-05: an added date does ----

Deno.test('an added event and an added anniversary record their text on the owner\'s partner\'s devices', async () => {
  const cases: [Record<string, unknown>, Parameters<typeof fakeDb>[0], string][] = [
    [{ kind: 'event', id: EVENT_ID }, { event }, 'Added an event: Paris trip'],
    [{ kind: 'anniversary', id: ANNIVERSARY_ID }, { anniversary }, 'Added an anniversary: First date'],
  ];
  for (const [body, options, text] of cases) {
    const claimed: PushRequestRow[] = [];
    const partnerLookups: string[] = [];
    const response = await handleSendPush(request(body), {
      db: fakeDb({ ...options, devices: TWO_DEVICES, claimed, partnerLookups }),
      apns: null,
    });
    assertEquals(await response.json(), { sent: 0, recorded: 2, skipped: 0, failed: 0, gone: 0 });
    assertEquals(partnerLookups, ['sender']);
    assertEquals(claimed.map((c) => [c.kind, c.source_id, c.token]), [
      [body.kind, body.id, 'tok-a'],
      [body.kind, body.id, 'tok-b'],
    ]);
    assertEquals(claimed[0].payload, {
      kind: body.kind as string,
      aps: { alert: { title: 'Casey', body: text }, 'thread-id': PARTNER_THREAD, badge: 0 },
    });
  }
});

Deno.test('an added date by an unlinked owner claims nothing', async () => {
  for (const [body, options] of [
    [{ kind: 'event', id: EVENT_ID }, { event }],
    [{ kind: 'anniversary', id: ANNIVERSARY_ID }, { anniversary }],
  ] as const) {
    const claimed: PushRequestRow[] = [];
    const response = await handleSendPush(request(body), {
      db: fakeDb({ ...options, partnerId: null, devices: TWO_DEVICES, claimed }),
      apns: null,
    });
    assertEquals(await response.json(), { sent: 0, recorded: 0, skipped: 0, failed: 0, gone: 0 });
    assertEquals(claimed.length, 0);
  }
});

Deno.test('a date post from an older trigger is a 400 and claims nothing', async () => {
  const claimed: PushRequestRow[] = [];
  const listed: string[] = [];
  const response = await handleSendPush(request({ kind: 'date', id: OLD_DATE_CHANGE_ID }), {
    db: fakeDb({ devices: TWO_DEVICES, claimed, listed }),
    apns: null,
  });
  assertEquals(response.status, 400);
  assertEquals(await response.json(), {
    error:
      'kind must be mood, photo, interaction, partner_request, partner_accept, event, anniversary, ' +
      'daily_nudge, daily_reminder or daily_both_answered',
  });
  assertEquals(claimed.length, 0);
  assertEquals(listed, []);
});

// ---- Story 3.6: partner requests ----

Deno.test('a partner request records the asker\'s name and R7 body on the asked person\'s devices', async () => {
  const claimed: PushRequestRow[] = [];
  const listed: string[] = [];
  const lookups: string[] = [];
  const response = await handleSendPush(request({ kind: 'partner_request', id: PARTNER_REQUEST_ID }), {
    db: fakeDb({
      partnerRequest: pendingRequest,
      devices: TWO_DEVICES,
      claimed,
      listed,
      partnerLookups: lookups,
    }),
    apns: null,
  });
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { sent: 0, recorded: 2, skipped: 0, failed: 0, gone: 0 });
  assertEquals(claimed.map((c) => [c.kind, c.source_id, c.token]), [
    ['partner_request', PARTNER_REQUEST_ID, 'tok-a'],
    ['partner_request', PARTNER_REQUEST_ID, 'tok-b'],
  ]);
  assertEquals(claimed[0].payload, {
    kind: 'partner_request',
    aps: { alert: { title: 'Casey', body: 'Sent you a partner request' }, 'thread-id': PARTNER_THREAD, badge: 0 },
  });
  // The asker is not a partner yet: no partner lookup, and only the asked person's devices.
  assertEquals(lookups, []);
  assertEquals(listed, ['recipient']);
});

Deno.test('a partner request from someone with no name is titled Someone', async () => {
  const claimed: PushRequestRow[] = [];
  await handleSendPush(request({ kind: 'partner_request', id: PARTNER_REQUEST_ID }), {
    db: fakeDb({ partnerRequest: pendingRequest, displayName: null, devices: [TWO_DEVICES[0]], claimed }),
    apns: null,
  });
  assertEquals(claimed[0].payload.aps.alert.title, 'Someone');
});

Deno.test('a partner request pushes whatever its status, and carries no sound or image', async () => {
  for (const status of ['pending', 'accepted', 'declined']) {
    const claimed: PushRequestRow[] = [];
    await handleSendPush(request({ kind: 'partner_request', id: PARTNER_REQUEST_ID }), {
      db: fakeDb({ partnerRequest: { ...pendingRequest, status }, devices: [TWO_DEVICES[0]], claimed }),
      apns: null,
    });
    assertEquals(claimed.length, 1, status);
    const { payload } = claimed[0];
    assertEquals(Object.keys(payload).sort(), ['aps', 'kind']);
    assertEquals(Object.keys(payload.aps).sort(), ['alert', 'badge', 'thread-id']);
  }
});

Deno.test('an acceptance records the accepter\'s name and R7 body on the asker\'s devices', async () => {
  const claimed: PushRequestRow[] = [];
  const listed: string[] = [];
  const lookups: string[] = [];
  const response = await handleSendPush(request({ kind: 'partner_accept', id: PARTNER_REQUEST_ID }), {
    db: fakeDb({
      partnerRequest: acceptedRequest,
      devices: TWO_DEVICES,
      claimed,
      listed,
      partnerLookups: lookups,
    }),
    apns: null,
  });
  assertEquals(await response.json(), { sent: 0, recorded: 2, skipped: 0, failed: 0, gone: 0 });
  assertEquals(claimed.map((c) => [c.kind, c.source_id, c.token]), [
    ['partner_accept', PARTNER_REQUEST_ID, 'tok-a'],
    ['partner_accept', PARTNER_REQUEST_ID, 'tok-b'],
  ]);
  assertEquals(claimed[0].payload, {
    kind: 'partner_accept',
    aps: { alert: { title: 'Casey', body: 'Accepted your partner request' }, 'thread-id': PARTNER_THREAD, badge: 0 },
  });
  assertEquals(lookups, []);
  assertEquals(listed, ['recipient']);
});

Deno.test('an acceptance from someone with no name is titled Your partner', async () => {
  const claimed: PushRequestRow[] = [];
  await handleSendPush(request({ kind: 'partner_accept', id: PARTNER_REQUEST_ID }), {
    db: fakeDb({ partnerRequest: acceptedRequest, displayName: '  ', devices: [TWO_DEVICES[0]], claimed }),
    apns: null,
  });
  assertEquals(claimed[0].payload.aps.alert.title, 'Your partner');
});

Deno.test('a forged or replayed acceptance for a request that is not accepted claims nothing', async () => {
  for (const status of ['pending', 'declined']) {
    const claimed: PushRequestRow[] = [];
    const listed: string[] = [];
    const response = await handleSendPush(request({ kind: 'partner_accept', id: PARTNER_REQUEST_ID }), {
      db: fakeDb({ partnerRequest: { ...acceptedRequest, status }, devices: TWO_DEVICES, claimed, listed }),
      apns: null,
    });
    assertEquals(response.status, 200, status);
    assertEquals(await response.json(), { sent: 0, recorded: 0, skipped: 0, failed: 0, gone: 0 });
    assertEquals(claimed.length, 0);
    assertEquals(listed, []);
  }
});

Deno.test('a partner request or acceptance addressed to its own sender claims nothing', async () => {
  for (const [kind, partnerRequest] of [
    ['partner_request', { ...pendingRequest, to_user_id: 'sender' }],
    ['partner_accept', { ...acceptedRequest, from_user_id: 'sender' }],
  ] as const) {
    const claimed: PushRequestRow[] = [];
    const response = await handleSendPush(request({ kind, id: PARTNER_REQUEST_ID }), {
      db: fakeDb({ partnerRequest, devices: TWO_DEVICES, claimed }),
      apns: null,
    });
    assertEquals(response.status, 200);
    assertEquals(await response.json(), { sent: 0, recorded: 0, skipped: 0, failed: 0, gone: 0 });
    assertEquals(claimed.length, 0);
  }
});

Deno.test('a replayed partner request or acceptance is skipped for every device', async () => {
  for (const [kind, partnerRequest] of [
    ['partner_request', pendingRequest],
    ['partner_accept', acceptedRequest],
  ] as const) {
    const claimed: PushRequestRow[] = [];
    const deps = { db: fakeDb({ partnerRequest, devices: TWO_DEVICES, claimed }), apns: null };
    await handleSendPush(request({ kind, id: PARTNER_REQUEST_ID }), deps);
    const second = await handleSendPush(request({ kind, id: PARTNER_REQUEST_ID }), deps);
    assertEquals(await second.json(), { sent: 0, recorded: 0, skipped: 2, failed: 0, gone: 0 });
    assertEquals(claimed.length, 2);
  }
});

Deno.test('a request and its acceptance are two claims on the same request id and token', async () => {
  const claimed: PushRequestRow[] = [];
  const db = (partnerRequest: PartnerRequestRow) =>
    fakeDb({ partnerRequest, devices: [TWO_DEVICES[0]], claimed });
  // `claimed` is shared, so a collision across kinds would show as a skip.
  const first = await handleSendPush(request({ kind: 'partner_request', id: PARTNER_REQUEST_ID }), {
    db: db(pendingRequest),
    apns: null,
  });
  const second = await handleSendPush(request({ kind: 'partner_accept', id: PARTNER_REQUEST_ID }), {
    db: db(acceptedRequest),
    apns: null,
  });
  assertEquals(await first.json(), { sent: 0, recorded: 1, skipped: 0, failed: 0, gone: 0 });
  assertEquals(await second.json(), { sent: 0, recorded: 1, skipped: 0, failed: 0, gone: 0 });
  assertEquals(claimed.map((c) => c.kind), ['partner_request', 'partner_accept']);
});

Deno.test('a failed APNs send for a partner request releases its claim by kind', async () => {
  for (const [kind, partnerRequest] of [
    ['partner_request', pendingRequest],
    ['partner_accept', acceptedRequest],
  ] as const) {
    const kinds: string[] = [];
    const db = fakeDb({ partnerRequest, devices: [TWO_DEVICES[0]] });
    const release = db.releaseRequest;
    db.releaseRequest = (releasedKind, sourceId, token) => {
      kinds.push(`${releasedKind}:${sourceId}`);
      return release(releasedKind, sourceId, token);
    };
    const apns: ApnsClient = {
      send: () => Promise.resolve({ ok: false, status: 500, reason: 'InternalServerError', timestamp: null }),
    };
    const response = await handleSendPush(request({ kind, id: PARTNER_REQUEST_ID }), { db, apns });
    assertEquals(await response.json(), { sent: 0, recorded: 0, skipped: 0, failed: 1, gone: 0 });
    assertEquals(kinds, [`${kind}:${PARTNER_REQUEST_ID}`]);
  }
});

Deno.test('a partner request kind with a non-uuid id is a 400', async () => {
  for (const kind of ['partner_request', 'partner_accept']) {
    const response = await handleSendPush(request({ kind, id: 'nope' }), {
      db: fakeDb({ partnerRequest: pendingRequest }),
      apns: null,
    });
    assertEquals(response.status, 400, kind);
    await response.body?.cancel();
  }
});

// ---- Story 3.7: the receiver's push switches ----

/** One post per kind, with the rows that make `recipient` its receiver. */
const KIND_CASES: { kind: PushKind; body: Record<string, string>; rows: Parameters<typeof fakeDb>[0] }[] = [
  { kind: 'love_note', body: { note_id: NOTE_ID }, rows: { note: textNote } },
  { kind: 'mood', body: { kind: 'mood', id: MOOD_ID }, rows: { mood: happyGrateful } },
  { kind: 'photo', body: { kind: 'photo', id: PHOTO_ID }, rows: { photo } },
  { kind: 'interaction', body: { kind: 'interaction', id: INTERACTION_ID }, rows: { interaction: poke } },
  {
    kind: 'partner_request',
    body: { kind: 'partner_request', id: PARTNER_REQUEST_ID },
    rows: { partnerRequest: pendingRequest },
  },
  {
    kind: 'partner_accept',
    body: { kind: 'partner_accept', id: PARTNER_REQUEST_ID },
    rows: { partnerRequest: acceptedRequest },
  },
  { kind: 'event', body: { kind: 'event', id: EVENT_ID }, rows: { event } },
  { kind: 'anniversary', body: { kind: 'anniversary', id: ANNIVERSARY_ID }, rows: { anniversary } },
  { kind: 'daily_nudge', body: { kind: 'daily_nudge', id: DAILY_NUDGE_ID }, rows: { dailyNudge } },
  {
    kind: 'daily_reminder',
    body: { kind: 'daily_reminder', id: DAILY_REMINDER_ID },
    rows: { dailyReminder: eveningSelf, partnerId: 'sender' },
  },
  {
    kind: 'daily_both_answered',
    body: { kind: 'daily_both_answered', id: DAILY_PICK_ID },
    rows: { dailyPick: secondPick },
  },
];

const ALL_PREFERENCES: PushPreference[] = [
  'love_notes',
  'moods',
  'photos',
  'pokes_and_kisses',
  'partner_requests',
  'dates',
  'daily_nudge',
  'daily_reminder',
  'daily_both_answered',
];

Deno.test('every kind answers to one switch; both partner kinds share one, as do both date kinds, and each of the three daily kinds has its own', () => {
  assertEquals(
    KIND_CASES.map((c) => [c.kind, PREFERENCE_FOR_KIND[c.kind]]),
    [
      ['love_note', 'love_notes'],
      ['mood', 'moods'],
      ['photo', 'photos'],
      ['interaction', 'pokes_and_kisses'],
      ['partner_request', 'partner_requests'],
      ['partner_accept', 'partner_requests'],
      ['event', 'dates'],
      ['anniversary', 'dates'],
      ['daily_nudge', 'daily_nudge'],
      ['daily_reminder', 'daily_reminder'],
      ['daily_both_answered', 'daily_both_answered'],
    ]
  );
  assertEquals(
    [...new Set(Object.values(PREFERENCE_FOR_KIND))].sort(),
    [...ALL_PREFERENCES].sort()
  );
});

Deno.test('a kind with its switch off answers zeros, claims nothing and lists no device', async () => {
  for (const { kind, body, rows } of KIND_CASES) {
    const claimed: PushRequestRow[] = [];
    const listed: string[] = [];
    const preference = PREFERENCE_FOR_KIND[kind];
    const response = await handleSendPush(request(body), {
      db: fakeDb({ ...rows, devices: TWO_DEVICES, claimed, listed, preferences: { [preference]: false } }),
      apns: null,
    });
    assertEquals(response.status, 200, kind);
    assertEquals(await response.json(), { sent: 0, recorded: 0, skipped: 0, failed: 0, gone: 0 }, kind);
    assertEquals(claimed.length, 0, kind);
    assertEquals(listed, [], kind);
  }
});

Deno.test('a switch that is off sends nothing to APNs either', async () => {
  const sends: string[] = [];
  const apns: ApnsClient = {
    send: (token) => {
      sends.push(token);
      return Promise.resolve({ ok: true, status: 200, reason: null, timestamp: null });
    },
  };
  const response = await handleSendPush(request({ note_id: NOTE_ID }), {
    db: fakeDb({ devices: TWO_DEVICES, preferences: { love_notes: false } }),
    apns,
  });
  assertEquals(await response.json(), { sent: 0, recorded: 0, skipped: 0, failed: 0, gone: 0 });
  assertEquals(sends, []);
});

Deno.test('another switch being off does not stop the kind', async () => {
  for (const { kind, body, rows } of KIND_CASES) {
    const claimed: PushRequestRow[] = [];
    const others = Object.fromEntries(
      ALL_PREFERENCES.filter((p) => p !== PREFERENCE_FOR_KIND[kind]).map((p) => [p, false])
    );
    const response = await handleSendPush(request(body), {
      db: fakeDb({ ...rows, devices: TWO_DEVICES, claimed, preferences: others }),
      apns: null,
    });
    assertEquals(await response.json(), { sent: 0, recorded: 2, skipped: 0, failed: 0, gone: 0 }, kind);
    assertEquals(claimed.length, 2, kind);
  }
});

Deno.test('with no preferences row every kind is on', async () => {
  for (const { kind, body, rows } of KIND_CASES) {
    const response = await handleSendPush(request(body), {
      db: fakeDb({ ...rows, devices: TWO_DEVICES }),
      apns: null,
    });
    assertEquals(await response.json(), { sent: 0, recorded: 2, skipped: 0, failed: 0, gone: 0 }, kind);
  }
});

Deno.test('a switch switched back on records again', async () => {
  const claimed: PushRequestRow[] = [];
  const preferences = { love_notes: false };
  const deps = { db: fakeDb({ devices: TWO_DEVICES, claimed, preferences }), apns: null };
  await handleSendPush(request({ note_id: NOTE_ID }), deps);
  assertEquals(claimed.length, 0);
  preferences.love_notes = true;
  const response = await handleSendPush(request({ note_id: NOTE_ID }), deps);
  assertEquals(await response.json(), { sent: 0, recorded: 2, skipped: 0, failed: 0, gone: 0 });
});

Deno.test('the switch is looked up for the recipient and never the sender', async () => {
  for (const { kind, body, rows } of KIND_CASES) {
    const preferenceLookups: [string, PushPreference][] = [];
    await handleSendPush(request(body), {
      db: fakeDb({ ...rows, devices: TWO_DEVICES, preferenceLookups }),
      apns: null,
    });
    assertEquals(preferenceLookups, [['recipient', PREFERENCE_FOR_KIND[kind]]], kind);
  }
});

Deno.test('nobody to tell reads no switch', async () => {
  const preferenceLookups: [string, PushPreference][] = [];
  await handleSendPush(request({ kind: 'mood', id: MOOD_ID }), {
    db: fakeDb({ mood: happyGrateful, partnerId: null, devices: TWO_DEVICES, preferenceLookups }),
    apns: null,
  });
  assertEquals(preferenceLookups, []);
});

Deno.test('a failed switch read answers 500 and claims nothing', async () => {
  const claimed: PushRequestRow[] = [];
  const listed: string[] = [];
  const response = await handleSendPush(request({ note_id: NOTE_ID }), {
    db: fakeDb({ devices: TWO_DEVICES, claimed, listed, failOn: 'isPushEnabled' }),
    apns: null,
  });
  assertEquals(response.status, 500);
  await response.body?.cancel();
  assertEquals(claimed.length, 0);
  assertEquals(listed, []);
});

// ---- Story 3.8: the badge ----

Deno.test('every kind records the recipient\'s unread count as aps.badge, zero included', async () => {
  for (const unreadCount of [0, 1, 7]) {
    for (const { kind, body, rows } of KIND_CASES) {
      const claimed: PushRequestRow[] = [];
      await handleSendPush(request(body), {
        db: fakeDb({ ...rows, devices: TWO_DEVICES, claimed, unreadCount }),
        apns: null,
      });
      assertEquals(claimed.length, 2, kind);
      for (const row of claimed) assertEquals(row.payload.aps.badge, unreadCount, `${kind} ${unreadCount}`);
    }
  }
});

// ---- Story 3.9: the kind ----

Deno.test('every kind records its own kind beside aps, and aps carries no kind', async () => {
  for (const { kind, body, rows } of KIND_CASES) {
    const claimed: PushRequestRow[] = [];
    await handleSendPush(request(body), {
      db: fakeDb({ ...rows, devices: TWO_DEVICES, claimed }),
      apns: null,
    });
    assertEquals(claimed.length, 2, kind);
    for (const row of claimed) {
      assertEquals(row.payload.kind, kind);
      assertEquals(Object.keys(row.payload).sort(), ['aps', 'kind'], kind);
      assertFalse('kind' in row.payload.aps, kind);
    }
  }
});

Deno.test('a poke and a kiss are both the interaction kind', async () => {
  for (const type of ['poke', 'kiss']) {
    const claimed: PushRequestRow[] = [];
    await handleSendPush(request({ kind: 'interaction', id: INTERACTION_ID }), {
      db: fakeDb({ interaction: { ...poke, type }, devices: [TWO_DEVICES[0]], claimed }),
      apns: null,
    });
    assertEquals(claimed[0].payload.kind, 'interaction', type);
  }
});

Deno.test('the badge and the kind reach APNs in the payload it sends', async () => {
  const sent: unknown[] = [];
  const apns: ApnsClient = {
    send: (_token, _environment, payload) => {
      sent.push(payload);
      return Promise.resolve({ ok: true, status: 200, reason: null, timestamp: null });
    },
  };
  await handleSendPush(request({ kind: 'mood', id: MOOD_ID }), {
    db: fakeDb({ mood: happyGrateful, devices: [TWO_DEVICES[0]], unreadCount: 2 }),
    apns,
  });
  assertEquals((sent[0] as { aps: { badge: number } }).aps.badge, 2);
  assertEquals((sent[0] as { kind: string }).kind, 'mood');
});

Deno.test('the count is looked up for the recipient and never the sender', async () => {
  for (const { kind, body, rows } of KIND_CASES) {
    const countLookups: string[] = [];
    await handleSendPush(request(body), {
      db: fakeDb({ ...rows, devices: TWO_DEVICES, countLookups }),
      apns: null,
    });
    assertEquals(countLookups, ['recipient'], kind);
  }
});

Deno.test('nobody to tell, or a switch that is off, reads no count', async () => {
  const countLookups: string[] = [];
  await handleSendPush(request({ kind: 'mood', id: MOOD_ID }), {
    db: fakeDb({ mood: happyGrateful, partnerId: null, devices: TWO_DEVICES, countLookups }),
    apns: null,
  });
  await handleSendPush(request({ note_id: NOTE_ID }), {
    db: fakeDb({ devices: TWO_DEVICES, countLookups, preferences: { love_notes: false } }),
    apns: null,
  });
  assertEquals(countLookups, []);
});

Deno.test('a failed count read answers 500 and claims nothing', async () => {
  const claimed: PushRequestRow[] = [];
  const response = await handleSendPush(request({ note_id: NOTE_ID }), {
    db: fakeDb({ devices: TWO_DEVICES, claimed, unreadCount: new Error('db down') }),
    apns: null,
  });
  assertEquals(response.status, 500);
  await response.body?.cancel();
  assertEquals(claimed.length, 0);
});

// ---- Stories 8.3 and 11.2: the three daily kinds ----

const ZEROS = { sent: 0, recorded: 0, skipped: 0, failed: 0, gone: 0 };

/** Posts one daily kind on the fixed clock and gives back the answer and what was claimed. */
async function postDaily(
  body: Record<string, string>,
  options: Parameters<typeof fakeDb>[0],
  devices: DeviceRow[] = [TWO_DEVICES[0]]
) {
  const claimed: PushRequestRow[] = [];
  const response = await handleSendPush(request(body), {
    db: fakeDb({ devices, claimed, ...options }),
    apns: null,
    now: () => NOW,
  });
  const status = response.status;
  const answer = await response.json();
  return { status, answer, claimed };
}

const BOTH_POST = { kind: 'daily_both_answered', id: DAILY_PICK_ID };
const NUDGE_POST = { kind: 'daily_nudge', id: DAILY_NUDGE_ID };
const EVENING_POST = { kind: 'daily_reminder', id: DAILY_REMINDER_ID };
/** The two kinds story 11.2 removed: the triggers that posted them are gone. */
const REMOVED_POSTS = [
  { kind: 'daily_question', id: DAILY_REMINDER_ID },
  { kind: 'daily_partner_picked', id: DAILY_PICK_ID },
];

Deno.test('both answered tells the first picker, titled the same for everyone, with no sound and no choice', async () => {
  const listed: string[] = [];
  const legacyReads: string[] = [];
  const { status, answer, claimed } = await postDaily(BOTH_POST, {
    dailyPick: secondPick,
    listed,
    legacyReads,
    // users.partner_id is not consulted for a pick: the pair decides.
    partnerId: 'someone-else',
  });
  assertEquals(status, 200);
  assertEquals(answer, { ...ZEROS, recorded: 1 });
  assertEquals(listed, ['recipient']);
  assertEquals(legacyReads, []);
  assertEquals(claimed[0].kind, 'daily_both_answered');
  assertEquals(claimed[0].source_id, DAILY_PICK_ID);
  assertEquals(claimed[0].payload, {
    kind: 'daily_both_answered',
    aps: {
      alert: { title: "You both answered today's question", body: 'Click to see what your partner answered!' },
      'thread-id': 'partner-activity',
      badge: 0,
    },
  });
  assertFalse('sound' in claimed[0].payload.aps);
  assertFalse(JSON.stringify(claimed[0].payload).includes('choice'));
});

Deno.test('a second pick made by the first seat goes to the second', async () => {
  const listed: string[] = [];
  await postDaily(BOTH_POST, { dailyPick: { ...secondPick, user_id: 'recipient' }, listed });
  assertEquals(listed, ['sender']);
});

Deno.test('both answered reads the same for a run of 0, 1 or 5, on a day that is not the recipient\'s date, and whoever the partner is', async () => {
  const reads: unknown[] = [];
  for (const streak of [
    { held: 0, run: 0 },
    { held: 9, run: 1 },
    { held: 9, run: 5 },
  ]) {
    for (const localDate of ['2027-01-15', '2027-01-16']) {
      for (const displayName of ['Casey', null, 'Jordan']) {
        const legacyReads: string[] = [];
        const { answer, claimed } = await postDaily(BOTH_POST, {
          dailyPick: secondPick,
          streak,
          localDate,
          displayName,
          legacyReads,
        });
        assertEquals(answer, { ...ZEROS, recorded: 1 });
        assertEquals(legacyReads, []);
        reads.push(claimed[0].payload);
      }
    }
  }
  assertEquals(new Set(reads.map((payload) => JSON.stringify(payload))).size, 1);
  const text = JSON.stringify(reads[0]);
  for (const forbidden of ['day in a row', 'days in a row', 'Casey', 'Jordan', 'Your partner', 'That day counts.', 'See ']) {
    assertFalse(text.includes(forbidden), forbidden);
  }
});

Deno.test('a pick by someone outside the day\'s pair tells nobody', async () => {
  const { answer, claimed } = await postDaily(BOTH_POST, { dailyPick: { ...secondPick, user_id: 'stranger' } });
  assertEquals(answer, ZEROS);
  assertEquals(claimed.length, 0);
});

Deno.test('a first pick pushes nobody, even posted as both answered, and claims nothing', async () => {
  const listed: string[] = [];
  const preferenceLookups: [string, PushPreference][] = [];
  const dayLookups: string[] = [];
  const { status, answer, claimed } = await postDaily(BOTH_POST, {
    dailyPick: firstPick,
    listed,
    preferenceLookups,
    dayLookups,
  });
  assertEquals(status, 200);
  assertEquals(answer, ZEROS);
  assertEquals(claimed.length, 0);
  assertEquals(listed, []);
  assertEquals(preferenceLookups, []);
  assertEquals(dayLookups, []);
});

Deno.test('a mis-posted first pick claims nothing, so the second pick posted later still records', async () => {
  const claimed: PushRequestRow[] = [];
  const base = { devices: TWO_DEVICES, claimed };
  assertEquals(
    await (await handleSendPush(request(BOTH_POST), { db: fakeDb({ ...base, dailyPick: firstPick }), apns: null, now: () => NOW })).json(),
    ZEROS
  );
  assertEquals(claimed.length, 0);
  assertEquals(
    await (await handleSendPush(request(BOTH_POST), { db: fakeDb({ ...base, dailyPick: secondPick }), apns: null, now: () => NOW })).json(),
    { ...ZEROS, recorded: 2 }
  );
  assertEquals(claimed.map((c) => c.kind), ['daily_both_answered', 'daily_both_answered']);
});

Deno.test('a nudge goes to_user, titled with from_user, says the sender answered, reads no streak and plays the default sound', async () => {
  const listed: string[] = [];
  const legacyReads: string[] = [];
  const dayLookups: string[] = [];
  const { status, answer, claimed } = await postDaily(NUDGE_POST, {
    dailyNudge,
    streak: { held: 12, run: 3 },
    listed,
    legacyReads,
    dayLookups,
  });
  assertEquals(status, 200);
  assertEquals(answer, { ...ZEROS, recorded: 1 });
  assertEquals(listed, ['recipient']);
  assertEquals(legacyReads, []);
  assertEquals(dayLookups, []);
  assertEquals(claimed[0].kind, 'daily_nudge');
  assertEquals(claimed[0].source_id, DAILY_NUDGE_ID);
  assertEquals(claimed[0].payload, {
    kind: 'daily_nudge',
    aps: {
      alert: {
        title: 'Casey nudged you',
        body: 'Casey answered the daily question and wants to know your answer!',
      },
      'thread-id': 'partner-activity',
      sound: 'default',
      badge: 0,
    },
  });
});

Deno.test('a nudge with a streak of 0 says the same', async () => {
  const { claimed } = await postDaily(NUDGE_POST, { dailyNudge, streak: { held: 0, run: 0 } });
  assertEquals(
    claimed[0].payload.aps.alert.body,
    'Casey answered the daily question and wants to know your answer!'
  );
  assertEquals(claimed[0].payload.aps.sound, 'default');
});

Deno.test('a held nudge not yet released answers zeros, claims nothing and lists no device', async () => {
  const claimed: PushRequestRow[] = [];
  const listed: string[] = [];
  const { status, answer } = await postDaily(NUDGE_POST, {
    dailyNudge: { ...dailyNudge, held: true, released_at: null },
    claimed,
    listed,
  });
  assertEquals(status, 200);
  assertEquals(answer, ZEROS);
  assertEquals(claimed, []);
  assertEquals(listed, []);
});

Deno.test('a held nudge once released sends the nudge, and the unreleased post claimed nothing so it still sends', async () => {
  const claimed: PushRequestRow[] = [];
  const held = { ...dailyNudge, held: true, released_at: null };
  await postDaily(NUDGE_POST, { dailyNudge: held, claimed });
  assertEquals(claimed, []);
  const { answer } = await postDaily(NUDGE_POST, {
    dailyNudge: { ...held, released_at: '2030-09-10T18:00:00+00:00' },
    claimed,
  });
  assertEquals(answer, { ...ZEROS, recorded: 1 });
  assertEquals(claimed.length, 1);
  assertEquals(claimed[0].payload.aps.alert.title, 'Casey nudged you');
});

Deno.test('a nudge that was never held sends with released_at null', async () => {
  const { answer } = await postDaily(NUDGE_POST, { dailyNudge: { ...dailyNudge, held: false, released_at: null } });
  assertEquals(answer, { ...ZEROS, recorded: 1 });
});

Deno.test('the 8 PM reminder to whoever has not answered is one wording with the default sound, and reads no day, date or streak', async () => {
  const dayLookups: string[] = [];
  const legacyReads: string[] = [];
  const listed: string[] = [];
  const { status, answer, claimed } = await postDaily(EVENING_POST, {
    dailyReminder: eveningSelf,
    partnerId: 'sender',
    dayLookups,
    legacyReads,
    listed,
  });
  assertEquals(status, 200);
  assertEquals(answer, { ...ZEROS, recorded: 1 });
  assertEquals(dayLookups, []);
  assertEquals(legacyReads, []);
  assertEquals(listed, ['recipient']);
  assertEquals(claimed[0].kind, 'daily_reminder');
  assertEquals(claimed[0].source_id, DAILY_REMINDER_ID);
  assertEquals(claimed[0].payload, {
    kind: 'daily_reminder',
    aps: {
      alert: { title: "Time's running out!", body: 'Answer your daily question before the day is over!' },
      'thread-id': 'partner-activity',
      sound: 'default',
      badge: 0,
    },
  });
});

Deno.test('the 8 PM reminder still sends when its couple day is gone: it names no question', async () => {
  const { status, answer } = await postDaily(EVENING_POST, {
    dailyReminder: eveningSelf,
    partnerId: 'sender',
    coupleDay: null,
  });
  assertEquals(status, 200);
  assertEquals(answer, { ...ZEROS, recorded: 1 });
});

Deno.test('a stored morning or evening_partner reminder posted as daily_reminder claims nothing', async () => {
  for (const dailyReminder of [morningReminder, eveningPartner]) {
    const listed: string[] = [];
    const partnerLookups: string[] = [];
    const preferenceLookups: [string, PushPreference][] = [];
    const { status, answer, claimed } = await postDaily(EVENING_POST, {
      dailyReminder,
      partnerId: 'sender',
      listed,
      partnerLookups,
      preferenceLookups,
    });
    assertEquals(status, 200, dailyReminder.kind);
    assertEquals(answer, ZEROS, dailyReminder.kind);
    assertEquals(claimed.length, 0, dailyReminder.kind);
    assertEquals(listed, [], dailyReminder.kind);
    assertEquals(partnerLookups, [], dailyReminder.kind);
    assertEquals(preferenceLookups, [], dailyReminder.kind);
  }
});

Deno.test('a reminder for someone with no partner tells nobody', async () => {
  const listed: string[] = [];
  const { status, answer, claimed } = await postDaily(EVENING_POST, {
    dailyReminder: eveningSelf,
    partnerId: null,
    listed,
  });
  assertEquals(status, 200);
  assertEquals(answer, ZEROS);
  assertEquals(claimed.length, 0);
  assertEquals(listed, []);
});

Deno.test('a posted daily_question or daily_partner_picked is a 400 and claims nothing', async () => {
  for (const post of REMOVED_POSTS) {
    const claimed: PushRequestRow[] = [];
    const listed: string[] = [];
    const preferenceLookups: [string, PushPreference][] = [];
    const { status, answer } = await postDaily(post, {
      dailyPick: firstPick,
      dailyReminder: morningReminder,
      partnerId: 'sender',
      claimed,
      listed,
      preferenceLookups,
    });
    assertEquals(status, 400, post.kind);
    assertEquals(answer, {
      error:
        'kind must be mood, photo, interaction, partner_request, partner_accept, event, anniversary, ' +
        'daily_nudge, daily_reminder or daily_both_answered',
    });
    assertEquals(claimed.length, 0, post.kind);
    assertEquals(listed, [], post.kind);
    assertEquals(preferenceLookups, [], post.kind);
  }
});

Deno.test('a partner with no name falls back to Your partner in the nudge title', async () => {
  const { claimed } = await postDaily(NUDGE_POST, { dailyNudge, displayName: null });
  assertEquals(claimed[0].payload.aps.alert.title, 'Your partner nudged you');
  assertEquals(
    claimed[0].payload.aps.alert.body,
    'Your partner answered the daily question and wants to know your answer!'
  );
});

const DAILY_CASES = KIND_CASES.filter((c) => c.kind.startsWith('daily_'));

Deno.test('each of the three daily switches off stops only its own kind for that person', async () => {
  assertEquals(DAILY_CASES.map((c) => c.kind), ['daily_nudge', 'daily_reminder', 'daily_both_answered']);
  for (const { kind, body, rows } of DAILY_CASES) {
    const listed: string[] = [];
    const preferenceLookups: [string, PushPreference][] = [];
    const off = await postDaily(body, { ...rows, listed, preferenceLookups, preferences: { [kind]: false } });
    assertEquals(off.status, 200, kind);
    assertEquals(off.answer, ZEROS, kind);
    assertEquals(off.claimed.length, 0, kind);
    assertEquals(listed, [], kind);
    assertEquals(preferenceLookups, [['recipient', kind]], kind);

    // That one switch off, the other two daily kinds still send to the same recipient.
    for (const other of DAILY_CASES.filter((c) => c.kind !== kind)) {
      const sends = await postDaily(other.body, { ...other.rows, preferences: { [kind]: false } });
      assertEquals(sends.answer, { ...ZEROS, recorded: 1 }, `${kind} off, ${other.kind}`);
    }

    // And with every other daily switch off and this one on, it still records.
    const others = Object.fromEntries(DAILY_CASES.filter((c) => c.kind !== kind).map((c) => [c.kind, false]));
    const on = await postDaily(body, { ...rows, preferences: others });
    assertEquals(on.answer, { ...ZEROS, recorded: 1 }, kind);
  }
});

Deno.test('a partner\'s own switch is read independently: the recipient\'s off leaves the partner\'s push of that kind', async () => {
  // The nudge sent the other way, from `recipient` to `sender`, answers to `sender`'s switch.
  const reverseNudge: DailyNudgeRow = { ...dailyNudge, from_user: 'recipient', to_user: 'sender' };
  const pairs: [Record<string, string>, Parameters<typeof fakeDb>[0], Parameters<typeof fakeDb>[0]][] = [
    [NUDGE_POST, { dailyNudge }, { dailyNudge: reverseNudge }],
    [
      BOTH_POST,
      { dailyPick: secondPick },
      { dailyPick: { ...secondPick, user_id: 'recipient' } },
    ],
  ];
  for (const [post, toRecipient, toSender] of pairs) {
    const kind = post.kind as PushPreference;
    const preferenceLookups: [string, PushPreference][] = [];
    const off = await postDaily(post, { ...toRecipient, preferences: { [kind]: false }, preferenceLookups });
    assertEquals(off.answer, ZEROS, kind);
    const on = await postDaily(post, {
      ...toSender,
      preferences: { [kind]: false },
      senderDevices: [TWO_DEVICES[0]],
      preferenceLookups,
    });
    assertEquals(on.answer, { ...ZEROS, recorded: 1 }, kind);
    assertEquals(preferenceLookups, [['recipient', kind], ['sender', kind]], kind);

    // And the partner's own switch off stops theirs while the recipient's, on, still sends.
    const senderOff = await postDaily(post, { ...toSender, senderPreferences: { [kind]: false }, senderDevices: [TWO_DEVICES[0]] });
    assertEquals(senderOff.answer, ZEROS, kind);
    const recipientOn = await postDaily(post, { ...toRecipient, senderPreferences: { [kind]: false } });
    assertEquals(recipientOn.answer, { ...ZEROS, recorded: 1 }, kind);
  }
  // The reminder has no reverse direction in this fake: its recipient is its own user_id.
  const reminderForSender: DailyReminderRow = { ...eveningSelf, user_id: 'sender' };
  const reminder = await postDaily(EVENING_POST, {
    dailyReminder: reminderForSender,
    partnerId: 'recipient',
    preferences: { daily_reminder: false },
    senderDevices: [TWO_DEVICES[0]],
  });
  assertEquals(reminder.answer, { ...ZEROS, recorded: 1 });
  const reminderOff = await postDaily(EVENING_POST, {
    dailyReminder: reminderForSender,
    partnerId: 'recipient',
    senderPreferences: { daily_reminder: false },
    senderDevices: [TWO_DEVICES[0]],
  });
  assertEquals(reminderOff.answer, ZEROS);
});

Deno.test('no posted kind reads the switch of daily_question or daily_partner_picked', async () => {
  for (const { kind, body, rows } of KIND_CASES) {
    const preferenceLookups: [string, PushPreference][] = [];
    await postDaily(body, { ...rows, preferenceLookups });
    assertEquals(preferenceLookups.length, 1, kind);
    for (const [, preference] of preferenceLookups) {
      assertFalse((preference as string) === 'daily_question', kind);
      assertFalse((preference as string) === 'daily_partner_picked', kind);
    }
  }
  assertEquals(Object.keys(PREFERENCE_FOR_KIND).filter((k) => k.startsWith('daily_')).sort(), [
    'daily_both_answered',
    'daily_nudge',
    'daily_reminder',
  ]);
});

Deno.test('a replayed daily post is skipped for every device', async () => {
  const claimed: PushRequestRow[] = [];
  const deps = { db: fakeDb({ dailyNudge, devices: TWO_DEVICES, claimed }), apns: null, now: () => NOW };
  assertEquals(await (await handleSendPush(request(NUDGE_POST), deps)).json(), { ...ZEROS, recorded: 2 });
  assertEquals(await (await handleSendPush(request(NUDGE_POST), deps)).json(), { ...ZEROS, skipped: 2 });
  assertEquals(claimed.length, 2);
});

Deno.test('a daily post whose row is gone is a 404', async () => {
  for (const post of [BOTH_POST, NUDGE_POST, EVENING_POST]) {
    const response = await handleSendPush(request(post), {
      db: fakeDb({ devices: TWO_DEVICES }),
      apns: null,
      now: () => NOW,
    });
    assertEquals(response.status, 404, post.kind);
    await response.body?.cancel();
  }
});

// A nudge and a reminder read no day: their rows are deleted with the couple day (ON DELETE CASCADE).
Deno.test('a second pick whose day is gone is a 404', async () => {
  const { status, claimed } = await postDaily(BOTH_POST, { dailyPick: secondPick, coupleDay: null });
  assertEquals(status, 404);
  assertEquals(claimed.length, 0);
});

Deno.test('a failed read of the day answers 500 and claims nothing', async () => {
  const listed: string[] = [];
  const { status, claimed } = await postDaily(BOTH_POST, { dailyPick: secondPick, failOn: 'getCoupleDay', listed });
  assertEquals(status, 500);
  assertEquals(claimed.length, 0);
  assertEquals(listed, []);
});

Deno.test('the sound and the kind reach APNs for a nudge and the reminder, and none for both answered', async () => {
  const sent: { aps: { sound?: string }; kind?: string }[] = [];
  const apns: ApnsClient = {
    send: (_token, _environment, payload) => {
      sent.push(payload as (typeof sent)[number]);
      return Promise.resolve({ ok: true, status: 200, reason: null, timestamp: null });
    },
  };
  for (const [post, rows] of [
    [NUDGE_POST, { dailyNudge }],
    [EVENING_POST, { dailyReminder: eveningSelf, partnerId: 'sender' }],
    [BOTH_POST, { dailyPick: secondPick }],
  ] as const) {
    await handleSendPush(request(post), {
      db: fakeDb({ ...rows, devices: [TWO_DEVICES[0]] }),
      apns,
      now: () => NOW,
    });
  }
  assertEquals(sent.map((p) => [p.kind, p.aps.sound]), [
    ['daily_nudge', 'default'],
    ['daily_reminder', 'default'],
    ['daily_both_answered', undefined],
  ]);
});

Deno.test('no daily payload carries a choice, and only the nudge and the 8 PM reminder carry a sound', async () => {
  const cases: [Record<string, string>, Parameters<typeof fakeDb>[0], string | undefined][] = [
    [BOTH_POST, { dailyPick: secondPick }, undefined],
    [NUDGE_POST, { dailyNudge }, 'default'],
    [EVENING_POST, { dailyReminder: eveningSelf, partnerId: 'sender' }, 'default'],
  ];
  for (const [post, options, sound] of cases) {
    const { claimed } = await postDaily(post, options);
    const payload = claimed[0].payload;
    assertEquals(payload.aps.sound, sound, post.kind);
    assertEquals(payload.aps['thread-id'], 'partner-activity', post.kind);
    assertEquals(payload.aps.badge, 0, post.kind);
    assertFalse(JSON.stringify(payload).toLowerCase().includes('choice'), post.kind);
  }
});

Deno.test('a daily kind with a non-uuid id is a 400', async () => {
  for (const kind of ['daily_nudge', 'daily_reminder', 'daily_both_answered']) {
    const response = await handleSendPush(request({ kind, id: 'nope' }), { db: fakeDb({}), apns: null });
    assertEquals(response.status, 400, kind);
    await response.body?.cancel();
  }
});
