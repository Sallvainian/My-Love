// Provisions the sim driver's fixture pair on the local Supabase stack:
// two confirmed accounts with fictional names, linked as partners, and enough
// rows that every view scrolls (events, moods, love notes, photos with their
// images). No E2E worker slot (tests/support/auth/worker-pool.ts) uses them,
// so a driver run never writes another worker's rows.
//
//   node scripts/sim-driver/provision.ts   (run by `sim provision`)
//
// Idempotent, as ensureUser/linkUserPair in tests/support/auth/global-setup.ts
// are: an existing account gets its password and name reset, and the pair's
// rows and photo objects are wiped and seeded afresh. Needs
// SIM_SUPABASE_URL and SIM_SUPABASE_SECRET_KEY (`sim` reads both from
// `supabase status`) and refuses any host but 127.0.0.1 or localhost.

import { randomUUID } from 'node:crypto';
import { crc32, deflateSync } from 'node:zlib';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { TEST_USER_PASSWORD } from '../../tests/support/test-credentials.ts';

const FIXTURE_PAIR = [
  { email: 'simdriver@test.example.com', displayName: 'Casey' },
  { email: 'simdriver-partner@test.example.com', displayName: 'Jessie' },
] as const;

function localConfig(): { url: string; key: string } {
  const url = process.env.SIM_SUPABASE_URL ?? '';
  const key = process.env.SIM_SUPABASE_SECRET_KEY ?? '';
  if (!url || !key) throw new Error('SIM_SUPABASE_URL and SIM_SUPABASE_SECRET_KEY must be set');
  const host = new URL(url).hostname;
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error(`refusing ${url}: the fixture pair lives on the local stack only`);
  }
  return { url, key };
}

async function findAuthUserId(admin: SupabaseClient, email: string): Promise<string> {
  const perPage = 1000;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listing users for ${email}: ${error.message}`);
    const found = data.users.find((u) => u.email?.toLowerCase() === email);
    if (found) return found.id;
    if (data.users.length < perPage) break;
  }
  throw new Error(`${email} was reported as registered but was not found`);
}

async function ensureUser(admin: SupabaseClient, email: string, displayName: string) {
  const { error } = await admin.auth.admin.createUser({
    email,
    password: TEST_USER_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (!error) return 'created';
  if (!/already.*registered/i.test(error.message)) {
    throw new Error(`creating ${email}: ${error.message}`);
  }
  const id = await findAuthUserId(admin, email);
  const { error: updateError } = await admin.auth.admin.updateUserById(id, {
    password: TEST_USER_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (updateError) throw new Error(`updating ${email}: ${updateError.message}`);
  // The profile keeps its own name once it exists, so reset it here too.
  const { error: nameError } = await admin
    .from('users')
    .update({ display_name: displayName, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (nameError) throw new Error(`resetting the name of ${email}: ${nameError.message}`);
  return 'reset';
}

// The profile row comes from a trigger on the auth user and can trail it.
async function profileId(admin: SupabaseClient, email: string): Promise<string> {
  for (let attempt = 1; attempt <= 10; attempt++) {
    const { data, error } = await admin.from('users').select('id').eq('email', email).single();
    if (!error && data?.id) return data.id as string;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no profile row for ${email}`);
}

// Seeded row counts: home shows at most six events; the rest is enough that
// Mood, Partner, Love Notes and Photos each scroll on the Duo's largest pose.
const EVENT_COUNT = 6;
const MOOD_COUNTS = [40, 30] as const; // signed-in account, partner
const NOTES_EACH_WAY = 40;
const PHOTOS_EACH = 12;
const PHOTO_SIZE = 64;

const MOOD_TYPES = [
  'loved',
  'happy',
  'content',
  'excited',
  'thoughtful',
  'grateful',
  'sad',
  'anxious',
  'frustrated',
  'angry',
  'lonely',
  'tired',
] as const;
const EVENT_ICONS = ['ring', 'plane', 'calendar'] as const;
const EVENT_LABELS = [
  'Dinner reservation',
  'Weekend away',
  'Concert night',
  'Picnic in the park',
  'Movie marathon',
  'Cooking class',
];
const NOTE_LINES = [
  'Thinking of you today.',
  'Saw something that made me smile and thought of you.',
  'Can not wait for this weekend.',
  'You make every day better.',
  'Coffee later?',
  'Missing you already.',
  'That was the best evening.',
  'Remember to take a break today.',
];

/** A YYYY-MM-DD date `days` after today, in local time. */
function localDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** An ISO time `minutes` before now. */
function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

/** A solid-colour RGB PNG, so each photo tile is told apart at a glance. */
function solidPng(size: number, [r, g, b]: readonly [number, number, number]): Buffer {
  const row = Buffer.alloc(1 + size * 3); // filter byte 0, then RGB triples
  for (let x = 0; x < size; x++) row.set([r, g, b], 1 + x * 3);
  const chunk = (type: string, data: Buffer) => {
    const typed = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typed));
    return Buffer.concat([length, typed, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit depth, truecolour, no interlace
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: size }, () => row)))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function check(what: string, error: { message: string } | null) {
  if (error) throw new Error(`${what}: ${error.message}`);
}

// Deletes only rows owned by, or sent between, the two fixture accounts, and
// only the photo objects under their own folders.
async function wipePair(admin: SupabaseClient, ids: readonly string[]) {
  check('wiping events', (await admin.from('events').delete().in('user_id', ids)).error);
  check('wiping moods', (await admin.from('moods').delete().in('user_id', ids)).error);
  check('wiping sent notes', (await admin.from('love_notes').delete().in('from_user_id', ids)).error);
  check('wiping received notes', (await admin.from('love_notes').delete().in('to_user_id', ids)).error);
  check('wiping photo rows', (await admin.from('photos').delete().in('user_id', ids)).error);
  for (const id of ids) {
    const { data, error } = await admin.storage.from('photos').list(id, { limit: 1000 });
    check(`listing ${id}'s photo objects`, error);
    const paths = (data ?? []).map((object) => `${id}/${object.name}`);
    if (paths.length > 0) {
      check(`removing ${id}'s photo objects`, (await admin.storage.from('photos').remove(paths)).error);
    }
  }
}

async function seedPair(admin: SupabaseClient, [first, second]: readonly [string, string]) {
  const events = EVENT_LABELS.slice(0, EVENT_COUNT).map((label, i) => ({
    user_id: first,
    label,
    event_date: localDate(3 + i * 9),
    icon: EVENT_ICONS[i % EVENT_ICONS.length],
  }));
  check('seeding events', (await admin.from('events').insert(events)).error);

  // One mood every 11 hours, so every created_at differs within an account.
  // The signed-in account's newest is from yesterday: a mood saved today
  // seeds the Mood form, and App's 5-minute sync reseeds it, wiping a tile
  // tapped during a check. The partner's newest is today, for the partner card.
  const lastNight = new Date();
  lastNight.setHours(0, 0, 0, 0);
  const firstOffset = Math.ceil((Date.now() - lastNight.getTime()) / 60_000) + 120;
  const moods = [first, second].flatMap((userId, owner) =>
    Array.from({ length: MOOD_COUNTS[owner] }, (_, i) => ({
      user_id: userId,
      mood_type: MOOD_TYPES[(i + owner * 5) % MOOD_TYPES.length],
      note: i % 3 === 0 ? 'A seeded mood for the simulator.' : null,
      created_at: minutesAgo((owner === 0 ? firstOffset : 30) + i * 11 * 60),
    }))
  );
  check('seeding moods', (await admin.from('moods').insert(moods)).error);

  // Alternating senders, one note every 37 minutes, oldest last.
  const notes = Array.from({ length: NOTES_EACH_WAY * 2 }, (_, i) => ({
    from_user_id: i % 2 === 0 ? first : second,
    to_user_id: i % 2 === 0 ? second : first,
    content: `${NOTE_LINES[i % NOTE_LINES.length]} (${NOTES_EACH_WAY * 2 - i})`,
    created_at: minutesAgo(5 + i * 37),
  }));
  check('seeding love notes', (await admin.from('love_notes').insert(notes)).error);

  const photos = [];
  for (const [owner, userId] of [first, second].entries()) {
    for (let i = 0; i < PHOTOS_EACH; i++) {
      const n = owner * PHOTOS_EACH + i;
      const png = solidPng(PHOTO_SIZE, [(n * 53) % 256, (n * 97 + 80) % 256, (n * 151 + 160) % 256]);
      const storagePath = `${userId}/${randomUUID()}.png`;
      const { error } = await admin.storage
        .from('photos')
        .upload(storagePath, png, { contentType: 'image/png', upsert: true });
      check(`uploading ${storagePath}`, error);
      photos.push({
        user_id: userId,
        storage_path: storagePath,
        filename: `seed-${n + 1}.png`,
        caption: `Seeded photo ${n + 1}`,
        file_size: png.length,
        width: PHOTO_SIZE,
        height: PHOTO_SIZE,
        mime_type: 'image/png',
        created_at: minutesAgo(60 + n * 180),
      });
    }
  }
  check('seeding photo rows', (await admin.from('photos').insert(photos)).error);

  return { events: events.length, moods: moods.length, notes: notes.length, photos: photos.length };
}

async function main() {
  const { url, key } = localConfig();
  const admin = createClient(url, key, { auth: { persistSession: false } });
  for (const { email, displayName } of FIXTURE_PAIR) {
    console.log(`${email} (${displayName}): ${await ensureUser(admin, email, displayName)}`);
  }
  const [first, second] = await Promise.all(FIXTURE_PAIR.map((u) => profileId(admin, u.email)));
  for (const [id, partner] of [
    [first, second],
    [second, first],
  ]) {
    const { error } = await admin.from('users').update({ partner_id: partner }).eq('id', id);
    if (error) throw new Error(`linking ${id} to ${partner}: ${error.message}`);
  }
  console.log('linked as partners');

  await wipePair(admin, [first, second]);
  const seeded = await seedPair(admin, [first, second]);
  console.log(
    `seeded ${seeded.events} events, ${seeded.moods} moods, ${seeded.notes} love notes, ${seeded.photos} photos`
  );
}

main().catch((error: unknown) => {
  console.error(`provision: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
