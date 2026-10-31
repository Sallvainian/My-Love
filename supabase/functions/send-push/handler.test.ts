import { assertEquals } from 'jsr:@std/assert@1';

import type { ApnsClient } from './apns.ts';
import {
  handleSendPush,
  secretsMatch,
  type DeviceRow,
  type NoteRow,
  type PushDb,
  type PushRequestRow,
} from './handler.ts';

const NOTE_ID = '11111111-1111-4111-8111-111111111111';
const SECRET = 'a-shared-secret-for-tests';

const textNote: NoteRow = {
  id: NOTE_ID,
  from_user_id: 'sender',
  to_user_id: 'recipient',
  content: 'Thinking of you',
  image_url: null,
};

function fakeDb(options: {
  note?: NoteRow | null;
  devices?: DeviceRow[];
  secret?: string | null;
  claimed?: PushRequestRow[];
  released?: string[];
  failOn?: 'getNote';
}): PushDb {
  const claimed = options.claimed ?? [];
  const note = options.note === undefined ? textNote : options.note;
  return {
    getSenderSecret: () => Promise.resolve(options.secret === undefined ? SECRET : options.secret),
    getNote: () =>
      options.failOn === 'getNote' ? Promise.reject(new Error('db down')) : Promise.resolve(note),
    getDisplayName: (userId) => Promise.resolve(userId === 'sender' ? 'Casey' : 'Jessie'),
    listDevices: (userId) => Promise.resolve(userId === 'recipient' ? (options.devices ?? []) : []),
    claimRequest: (row) => {
      if (claimed.some((c) => c.note_id === row.note_id && c.token === row.token)) {
        return Promise.resolve(false);
      }
      claimed.push(row);
      return Promise.resolve(true);
    },
    releaseRequest: (_noteId, token) => {
      options.released?.push(token);
      const index = claimed.findIndex((c) => c.token === token);
      if (index >= 0) claimed.splice(index, 1);
      return Promise.resolve();
    },
  };
}

function request(body: unknown, headers: Record<string, string> = { 'x-push-secret': SECRET }): Request {
  return new Request('http://sender.test/send-push', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const TWO_DEVICES: DeviceRow[] = [
  { token: 'tok-a', environment: 'sandbox' },
  { token: 'tok-b', environment: 'production' },
];

Deno.test('unconfigured: every device gets a recorded request and nothing is sent', async () => {
  const claimed: PushRequestRow[] = [];
  const response = await handleSendPush(request({ note_id: NOTE_ID }), {
    db: fakeDb({ devices: TWO_DEVICES, claimed }),
    apns: null,
  });
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { sent: 0, recorded: 2, skipped: 0, failed: 0 });
  assertEquals(claimed.map((c) => [c.token, c.environment, c.delivery]), [
    ['tok-a', 'sandbox', 'recorded'],
    ['tok-b', 'production', 'recorded'],
  ]);
  assertEquals(claimed[0].payload, {
    aps: { alert: { title: 'Casey', body: 'Thinking of you' }, 'thread-id': 'love-notes' },
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
  assertEquals(await second.json(), { sent: 0, recorded: 0, skipped: 2, failed: 0 });
  assertEquals(claimed.length, 2);
});

Deno.test('configured: each device is sent to with its own environment', async () => {
  const sends: [string, string][] = [];
  const apns: ApnsClient = {
    send: (token, environment) => {
      sends.push([token, environment]);
      return Promise.resolve({ ok: true, status: 200, reason: null });
    },
  };
  const claimed: PushRequestRow[] = [];
  const response = await handleSendPush(request({ note_id: NOTE_ID }), {
    db: fakeDb({ devices: TWO_DEVICES, claimed }),
    apns,
  });
  assertEquals(await response.json(), { sent: 2, recorded: 0, skipped: 0, failed: 0 });
  assertEquals(sends, [
    ['tok-a', 'sandbox'],
    ['tok-b', 'production'],
  ]);
  assertEquals(claimed.map((c) => c.delivery), ['sent', 'sent']);
});

Deno.test('a refused send releases its claim so a retry can send it', async () => {
  const released: string[] = [];
  const apns: ApnsClient = {
    send: () => Promise.resolve({ ok: false, status: 400, reason: 'BadDeviceToken' }),
  };
  const claimed: PushRequestRow[] = [];
  const response = await handleSendPush(request({ note_id: NOTE_ID }), {
    db: fakeDb({ devices: [TWO_DEVICES[0]], claimed, released }),
    apns,
  });
  assertEquals(await response.json(), { sent: 0, recorded: 0, skipped: 0, failed: 1 });
  assertEquals(released, ['tok-a']);
  assertEquals(claimed.length, 0);
});

Deno.test('a recipient with no devices sends nothing', async () => {
  const response = await handleSendPush(request({ note_id: NOTE_ID }), {
    db: fakeDb({ devices: [] }),
    apns: null,
  });
  assertEquals(await response.json(), { sent: 0, recorded: 0, skipped: 0, failed: 0 });
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
        : Promise.resolve({ ok: true, status: 200, reason: null }),
  };
  const claimed: PushRequestRow[] = [];
  const response = await handleSendPush(request({ note_id: NOTE_ID }), {
    db: fakeDb({ devices: TWO_DEVICES, claimed, released }),
    apns,
  });
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { sent: 1, recorded: 0, skipped: 0, failed: 1 });
  assertEquals(released, ['tok-a']);
  assertEquals(claimed.map((c) => c.token), ['tok-b']);
});

Deno.test('a failing release does not turn the answer into a 500', async () => {
  const apns: ApnsClient = {
    send: (token) =>
      Promise.resolve(
        token === 'tok-a'
          ? { ok: false, status: 400, reason: 'BadDeviceToken' }
          : { ok: true, status: 200, reason: null }
      ),
  };
  const db = fakeDb({ devices: TWO_DEVICES });
  db.releaseRequest = () => Promise.reject(new Error('db down'));
  const response = await handleSendPush(request({ note_id: NOTE_ID }), { db, apns });
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { sent: 1, recorded: 0, skipped: 0, failed: 1 });
});

Deno.test('a failing claim fails that device and keeps the others', async () => {
  const db = fakeDb({ devices: TWO_DEVICES });
  const claim = db.claimRequest;
  db.claimRequest = (row) =>
    row.token === 'tok-a' ? Promise.reject(new Error('db down')) : claim(row);
  const response = await handleSendPush(request({ note_id: NOTE_ID }), { db, apns: null });
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { sent: 0, recorded: 1, skipped: 0, failed: 1 });
});

Deno.test('a declared body over the limit is refused with 413', async () => {
  const response = await handleSendPush(
    request({ note_id: NOTE_ID }, { 'x-push-secret': SECRET, 'content-length': '2000' }),
    { db: fakeDb({ devices: TWO_DEVICES }), apns: null }
  );
  assertEquals(response.status, 413);
  await response.body?.cancel();
});
