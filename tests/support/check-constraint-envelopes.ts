/**
 * The PostgREST envelope a CHECK-constraint rejection actually arrives in.
 *
 * `src/api/errorHandlers.ts:66` maps SQLSTATE `23514` to a generic sentence so
 * the raw Postgres text never reaches the user. Everything that asserts on that
 * mapping needs the same input, and the input is a wire format — not something
 * to re-invent per spec. This module holds it once, with no imports, the way
 * `./test-credentials.ts` holds the shared password: Vitest specs and Playwright
 * specs both consume it, so it must stay free of any test-framework import.
 *
 * Every literal below was MEASURED against this repo's local stack on
 * 2026-08-19 (postgrest/13.0.5, reported in the `Server:` response header),
 * not copied from documentation.
 *
 * ## The measurement, and the thing it corrected
 *
 * The envelope is NOT the same for every caller. Probing first with the secret
 * (service-role) key and then with a signed-in user's JWT returns two different
 * bodies for the identical rejection:
 *
 *   # service_role
 *   curl -s -X POST 'http://127.0.0.1:54321/rest/v1/events' \
 *     -H "apikey: $SECRET_KEY" -H "Authorization: Bearer $SECRET_KEY" \
 *     -H 'Content-Type: application/json' \
 *     -d '{"user_id":"…0001","label":"probe","event_date":"2030-01-01","icon":"not-an-icon"}'
 *   -> {"code":"23514",
 *       "details":"Failing row contains (c3760217-…, …, probe, 2030-01-01, null, not-an-icon, …).",
 *       "hint":null,
 *       "message":"new row for relation \"events\" violates check constraint \"events_icon_check\""}
 *
 *   # authenticated — a token from testworker0@test.example.com
 *   curl -s -X POST 'http://127.0.0.1:54321/rest/v1/events' \
 *     -H "apikey: $PUBLISHABLE_KEY" -H "Authorization: Bearer $USER_JWT" … same body
 *   -> {"code":"23514","details":null,"hint":null,
 *       "message":"new row for relation \"events\" violates check constraint \"events_icon_check\""}
 *
 * Postgres withholds `Failing row contains (…)` from a non-privileged role, so
 * **the app never receives it**. The `AUTHENTICATED_*` constants below are the
 * envelope the browser actually gets and are what specs should inject; the
 * `SERVICE_ROLE_*` one is kept as the measured contrast, because a spec that
 * asserts "the failing row never reaches the user" has to be honest that the
 * server never sent it in the first place.
 *
 * Both were confirmed for `events` (label and icon), `interactions` (type) and
 * `moods` (note) — all three tables written through a module that imports
 * `handleSupabaseError`.
 *
 * ## Two properties that are load-bearing and easy to lose
 *
 * 1. **The HTTP status is 400, not 500.** Measured from the response line
 *    (`HTTP/1.1 400 Bad Request`, `Proxy-Status: PostgREST; error=23514`) under
 *    both roles. A stub that fulfils with 500 is testing a response the server
 *    never sends.
 *
 * 2. **`details` is present-and-`null`, not absent.** `isPostgrestError`
 *    (`src/api/errorHandlers.ts:109-117`) keys on the *presence* of `code`,
 *    `message` and `details` — it never looks at `hint`, and it never checks a
 *    value. JSON `null` still produces the property, so the guard passes and
 *    the SQLSTATE map is consulted. An envelope that omitted `details` entirely
 *    would route down the network branch instead and the map would never run.
 *
 * ## The constraint set
 *
 * Measured from the catalogue, not read off the migrations:
 *
 *   docker exec supabase_db_My-Love psql -U postgres -d postgres -c \
 *     "select conrelid::regclass, conname, pg_get_constraintdef(oid)
 *        from pg_constraint where contype='c' and connamespace='public'::regnamespace"
 *
 * It returns 14 rows. Seven sit on tables written through a module that imports
 * `handleSupabaseError` — `events` (3), `moods` (3), `interactions` (1) — and
 * seven do not: `love_notes` (2), `partner_requests` (2), `photos` (2) and
 * `scripture_reflections` (1). Only the first seven are covered by the map.
 */

/**
 * The wire shape. `details` and `hint` are nullable because PostgREST sends
 * them as JSON `null`; the SDK's `PostgrestError` class types both as plain
 * `string`, which every measured response contradicts. Specs cast to
 * `PostgrestError` at the call site rather than substituting empty strings the
 * server never sent.
 */
export interface PostgrestErrorEnvelope {
  code: string;
  details: string | null;
  hint: string | null;
  message: string;
}

/** The HTTP status PostgREST returns for SQLSTATE 23514. Measured, not assumed. */
export const CHECK_VIOLATION_HTTP_STATUS = 400;

/** SQLSTATE for `check_violation`. */
export const CHECK_VIOLATION_CODE = '23514';

/**
 * The user-facing text the `23514` key must produce, copied from
 * `src/api/errorHandlers.ts:66`. Asserted with `toBe`, never a substring: the
 * regression being guarded is the *fallback* re-appearing, and
 * `Database error: <raw>` would still satisfy a loose match on any word here.
 */
export const CHECK_VIOLATION_MESSAGE =
  'Some values are not allowed - check length and format limits';

/**
 * Substrings that must never survive into a user-facing message. The first two
 * are what the raw Postgres sentence is made of; the third is the fallback
 * branch's own prefix, which is the only way the raw sentence can get out.
 */
export const LEAK_MARKERS = ['check constraint', 'new row for relation', 'Database error:'] as const;

/** Build the authenticated-caller envelope for one table and constraint. */
function authenticatedCheckViolation(table: string, constraint: string): PostgrestErrorEnvelope {
  return {
    code: CHECK_VIOLATION_CODE,
    details: null,
    hint: null,
    message: `new row for relation "${table}" violates check constraint "${constraint}"`,
  };
}

/** `events.label` over 100 characters — the case the story's spec quotes. */
export const AUTHENTICATED_EVENTS_LABEL_CHECK = authenticatedCheckViolation(
  'events',
  'events_label_check'
);

/** `events.icon` outside ('ring','plane','calendar'). */
export const AUTHENTICATED_EVENTS_ICON_CHECK = authenticatedCheckViolation(
  'events',
  'events_icon_check'
);

/** `interactions.type` outside ('poke','kiss'). */
export const AUTHENTICATED_INTERACTIONS_TYPE_CHECK = authenticatedCheckViolation(
  'interactions',
  'interactions_type_check'
);

/** `moods.note` over 500 characters. */
export const AUTHENTICATED_MOODS_NOTE_CHECK = authenticatedCheckViolation(
  'moods',
  'moods_note_check'
);

/**
 * What a **service_role** caller gets for the same `events.icon` rejection.
 *
 * Kept verbatim, and used only to document the difference: `details` carries
 * the whole failing row, including the label the user typed. Nothing in `src/`
 * runs as service_role — the browser client is built with the publishable key
 * (`src/api/supabaseClient.ts:55`) — so this is the shape the app does NOT
 * receive. The `n…n...` / `x…x...` style elision inside such a `details` string
 * is Postgres's own: it prints the first 64 characters of an over-long value
 * and appends a literal `...`.
 */
export const SERVICE_ROLE_EVENTS_ICON_CHECK: PostgrestErrorEnvelope = {
  code: '23514',
  details:
    'Failing row contains (c3760217-ad5b-403f-af82-905078342ded, 00000000-0000-0000-0000-000000000001, probe, 2030-01-01, null, not-an-icon, 2026-08-19 20:54:19.405547+00, 2026-08-19 20:54:19.405547+00).',
  hint: null,
  message: 'new row for relation "events" violates check constraint "events_icon_check"',
};

/**
 * A CHECK-violation envelope with the fields a caller wants to vary.
 *
 * Defaults to the authenticated `events_label_check` rejection, because that is
 * both the shape the app receives and the leak the story's spec quotes. `code`
 * is overridable on purpose: a test that needs to prove the mapping is keyed on
 * `23514` and nothing else flips it to a neighbouring SQLSTATE and expects the
 * fallback back.
 */
export function checkViolation(
  overrides: Partial<PostgrestErrorEnvelope> = {}
): PostgrestErrorEnvelope {
  return { ...AUTHENTICATED_EVENTS_LABEL_CHECK, ...overrides };
}
