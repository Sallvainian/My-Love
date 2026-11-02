// Seeds and removes the dates the shell's date reminders are planned from
// (story 4.1), for the sim driver's fixture pair, Casey and Jessie, on the
// local stack only.
//
//   node scripts/sim-driver/dates.ts kinds|many|clear   (run by `sim dates`)
//
// kinds  One date of each kind, so `sim pending` shows every reminder text:
//        Casey gets an event in 3 days, an anniversary in 4, a relationship
//        start years ago whose calendar date is 5 days ahead, a wedding date
//        in 6 and a birthday in 7; Jessie gets a birthday in 8.
// many   More due reminders than iOS keeps: 50 Casey events 2..51 days ahead
//        and 10 Casey anniversaries 2..11 days ahead, which plan 70 reminders
//        (50 + 10 x 2), and no other date.
// clear  Deletes both people's events and anniversaries and the pair's
//        couple_settings row, and nulls both birthdays.
//
// kinds and many each clear first, so the result is exactly what is listed
// and the 6 events `sim provision` seeds do not add reminders. `sim provision`
// restores only those events; it leaves anniversaries, the couple settings and
// birthdays. To get back the provisioned state, run `sim dates clear`, then
// `sim provision`. Needs SIM_SUPABASE_URL and
// SIM_SUPABASE_SECRET_KEY, as provision.ts does, and refuses any host but
// 127.0.0.1 or localhost.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { FIXTURE_PAIR, check, localConfig, profileId } from './provision.ts';

/** A YYYY-MM-DD date `days` after today, in local time, with its year replaced. */
function localDate(days: number, year?: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year ?? date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Leap years, so every month and day (29 February included) exists in them.
const ANNIVERSARY_YEAR = 2020;
const CASEY_BIRTH_YEAR = 1996;
const JESSIE_BIRTH_YEAR = 1992;

type Ids = { casey: string; jessie: string };

async function fixtureIds(admin: SupabaseClient): Promise<Ids> {
  const [casey, jessie] = await Promise.all(FIXTURE_PAIR.map((user) => profileId(admin, user.email)));
  return { casey, jessie };
}

/** The couple_settings key: the two ids in key order, as the table's CHECK requires. */
function pairKey({ casey, jessie }: Ids): { user_a: string; user_b: string } {
  return casey < jessie ? { user_a: casey, user_b: jessie } : { user_a: jessie, user_b: casey };
}

async function clearDates(admin: SupabaseClient, ids: Ids) {
  const both = [ids.casey, ids.jessie];
  check('deleting events', (await admin.from('events').delete().in('user_id', both)).error);
  check('deleting anniversaries', (await admin.from('anniversaries').delete().in('user_id', both)).error);
  const { user_a, user_b } = pairKey(ids);
  check(
    'deleting the couple settings',
    (await admin.from('couple_settings').delete().eq('user_a', user_a).eq('user_b', user_b)).error
  );
  check('clearing the birthdays', (await admin.from('users').update({ birthday: null }).in('id', both)).error);
}

async function seedKinds(admin: SupabaseClient, ids: Ids) {
  await clearDates(admin, ids);
  check(
    'seeding the event',
    (await admin.from('events').insert({
      user_id: ids.casey,
      label: 'Lake weekend',
      event_date: localDate(3),
      icon: 'plane',
    })).error
  );
  check(
    'seeding the anniversary',
    (await admin.from('anniversaries').insert({
      user_id: ids.casey,
      label: 'First dance',
      event_date: localDate(4, ANNIVERSARY_YEAR),
    })).error
  );
  const [year, month, day] = localDate(5, ANNIVERSARY_YEAR).split('-').map(Number);
  check(
    'seeding the couple settings',
    (await admin.from('couple_settings').upsert(
      {
        ...pairKey(ids),
        // Local noon, so the calendar date is the same in any zone near this one.
        relationship_start: new Date(year, month - 1, day, 12, 0).toISOString(),
        wedding_date: localDate(6),
      },
      { onConflict: 'user_a,user_b' }
    )).error
  );
  check(
    "seeding Casey's birthday",
    (await admin.from('users').update({ birthday: localDate(7, CASEY_BIRTH_YEAR) }).eq('id', ids.casey)).error
  );
  check(
    "seeding Jessie's birthday",
    (await admin.from('users').update({ birthday: localDate(8, JESSIE_BIRTH_YEAR) }).eq('id', ids.jessie)).error
  );
  console.log(
    'kinds: Casey has an event in 3 days, an anniversary in 4, the relationship start in 5, the wedding in 6 and a birthday in 7; Jessie has a birthday in 8'
  );
}

async function seedMany(admin: SupabaseClient, ids: Ids) {
  await clearDates(admin, ids);
  const events = Array.from({ length: 50 }, (_, i) => ({
    user_id: ids.casey,
    label: `Event ${i + 1}`,
    event_date: localDate(i + 2),
    icon: 'calendar',
  }));
  check('seeding events', (await admin.from('events').insert(events)).error);
  const anniversaries = Array.from({ length: 10 }, (_, i) => ({
    user_id: ids.casey,
    label: `Anniversary ${i + 1}`,
    event_date: localDate(i + 2, ANNIVERSARY_YEAR),
  }));
  check('seeding anniversaries', (await admin.from('anniversaries').insert(anniversaries)).error);
  console.log('many: 50 Casey events 2..51 days ahead and 10 Casey anniversaries 2..11 days ahead (70 reminders)');
}

async function main() {
  const command = process.argv[2];
  if (command !== 'kinds' && command !== 'many' && command !== 'clear') {
    throw new Error('usage: dates.ts kinds|many|clear');
  }
  const { url, key } = localConfig();
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const ids = await fixtureIds(admin);

  if (command === 'kinds') await seedKinds(admin, ids);
  else if (command === 'many') await seedMany(admin, ids);
  else {
    await clearDates(admin, ids);
    console.log('clear: dates removed; run `sim provision` now to restore the seeded events');
  }
}

main().catch((error: unknown) => {
  console.error(`dates: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
