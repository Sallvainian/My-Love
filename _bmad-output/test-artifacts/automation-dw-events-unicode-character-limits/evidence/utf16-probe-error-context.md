# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/events-unicode.spec.ts >> Unicode event character limits >> [P1] DW83-E2E-001 add emoji then edit decomposed at both limits
- Location: _bmad-output/test-artifacts/automation-dw-events-unicode-character-limits/e2e/events-unicode.spec.ts:118:5

# Error details

```
NetworkTimeoutError: Request timeout while observing network call
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - generic [ref=e5]:
      - button "Open navigation menu" [ref=e6]
      - generic [ref=e8]: My Love
  - main [ref=e10]:
    - generic [ref=e11]:
      - heading "Settings" [level=1] [ref=e13]
      - generic [ref=e14]:
        - generic [ref=e15]:
          - heading "Account" [level=2] [ref=e16]
          - generic [ref=e17]:
            - generic [ref=e21]:
              - paragraph [ref=e22]: testworker0@test.example.com
              - paragraph [ref=e23]: Signed in
            - button "Sign Out" [ref=e24] [cursor=pointer]
        - generic [ref=e27]:
          - heading "Events" [level=2] [ref=e28]
          - generic [ref=e30]:
            - generic [ref=e31]:
              - generic [ref=e32]:
                - heading "Event Countdowns" [level=2] [ref=e33]
                - paragraph [ref=e34]: Countdowns you and your partner both see. Past events stay here so a wrong date can be fixed.
              - button "Add event" [ref=e35]:
                - generic [ref=e37]: Add Event
            - generic [ref=e39]:
              - paragraph [ref=e42]: No events yet. Add one you are both counting down to.
              - button "Add your first event" [ref=e43]
            - status [ref=e45]: 0 events loaded. No more history to load.
            - dialog [ref=e46]:
              - generic [ref=e47]:
                - generic [ref=e48]:
                  - heading "Add Event" [level=3] [ref=e49]
                  - button "Close form" [ref=e50]
                - generic [ref=e54]:
                  - generic [ref=e55]:
                    - generic [ref=e56]: Label *
                    - textbox "Label *" [invalid] [ref=e57]:
                      - /placeholder: e.g., Gracie visits
                      - text: 💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖
                    - alert [ref=e58]: Label must be 100 characters or fewer
                  - generic [ref=e59]:
                    - generic [ref=e60]: Date *
                    - textbox "Date *" [ref=e61]: 2026-10-12
                  - generic [ref=e62]:
                    - generic [ref=e63]: Description (optional)
                    - textbox "Description (optional)" [invalid] [ref=e64]:
                      - /placeholder: Add a note about this event...
                      - text: 💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖💖
                    - alert [ref=e65]: Description must be 500 characters or fewer
                  - group "Icon" [ref=e66]:
                    - generic [ref=e68]:
                      - generic [ref=e69]:
                        - radio "Calendar" [checked] [ref=e70]
                        - generic [ref=e71] [cursor=pointer]: Calendar
                      - generic [ref=e74]:
                        - radio "Ring" [ref=e75]
                        - generic [ref=e76] [cursor=pointer]: Ring
                      - generic [ref=e80]:
                        - radio "Plane" [ref=e81]
                        - generic [ref=e82] [cursor=pointer]: Plane
                  - generic [ref=e85]:
                    - button "Cancel" [ref=e86]
                    - button "Add" [active] [ref=e90]
        - generic [ref=e93]:
          - heading "Anniversary" [level=2] [ref=e94]
          - generic [ref=e96]:
            - generic [ref=e97]:
              - generic [ref=e98]:
                - heading "Anniversary Countdowns" [level=2] [ref=e99]
                - paragraph [ref=e100]: Manage special dates and milestones
              - button "Add Anniversary" [ref=e101]
            - paragraph [ref=e108]: No anniversaries yet. Add your first special date!
        - generic [ref=e109]:
          - heading "About" [level=2] [ref=e110]
          - generic [ref=e112]:
            - paragraph [ref=e113]: My Love
            - paragraph [ref=e114]: Version 1.0.0
            - paragraph [ref=e115]: A personal connection app for you and your partner
```

# Test source

```ts
  1   | /** Unicode character limits through the real Settings form and local PostgREST. */
  2   | import type { Page, Request, TestType } from '@playwright/test';
  3   | import { log } from '@seontechnologies/playwright-utils';
  4   | import type { InterceptNetworkCallFn } from '@seontechnologies/playwright-utils/intercept-network-call';
  5   | import { test, expect } from '../../../../tests/support/merged-fixtures';
  6   | import { eventDateFrom } from '../../../../tests/support/factories/events';
  7   | import {
  8   |   EventRowSchema, EventRowsSchema, mixedUnicodeEvent, padForForm, unicodeCases,
  9   |   type EventRow,
  10  | } from '../support/unicode-events';
  11  | 
  12  | type TestFixtures = typeof test extends TestType<infer T, infer W> ? T & W : never;
  13  | type Recurse = TestFixtures['recurse'];
  14  | type EventText = { label: string; description: string };
  15  | type BrowserTools = { page: Page; interceptNetworkCall: InterceptNetworkCallFn; recurse: Recurse };
  16  | const EVENTS_URL = '**/rest/v1/events*';
  17  | 
  18  | async function openSettings({ page, interceptNetworkCall, recurse }: BrowserTools) {
  19  |   const read = interceptNetworkCall({ method: 'GET', url: EVENTS_URL });
  20  |   await page.goto('/settings');
  21  |   expect((await read).status).toBe(200);
  22  |   await recurse(
  23  |     () => page.evaluate(() => {
  24  |       const state = window.__APP_STORE__!.getState();
  25  |       return !state.eventsIsLoading && state.eventsPagination !== null;
  26  |     }),
  27  |     (ready) => ready,
  28  |     { timeout: 15000, interval: 50, log: 'Wait for the initial events snapshot' }
  29  |   );
  30  |   await expect(page.getByTestId('settings-view')).toBeVisible();
  31  |   await expect(page.getByTestId('events-settings-load-region')).toHaveAttribute('aria-busy', 'false');
  32  | }
  33  | 
  34  | async function fillText(page: Page, text: EventText) {
  35  |   await page.getByTestId('events-form-label').fill(padForForm(text.label));
  36  |   await page.getByTestId('events-form-description').fill(padForForm(text.description));
  37  |   // Browser-entered values must retain every code point before trimming on submit.
  38  |   await expect(page.getByTestId('events-form-label')).toHaveValue(padForForm(text.label));
  39  |   await expect(page.getByTestId('events-form-description')).toHaveValue(padForForm(text.description));
  40  | }
  41  | 
  42  | async function expectStoreAndRow(page: Page, recurse: Recurse, row: EventRow) {
  43  |   const saved = await recurse(
  44  |     () => page.evaluate((id) => {
  45  |       const event = window.__APP_STORE__!.getState().events.find((item) => item.id === id);
  46  |       return event ? { id: event.id, label: event.label, description: event.description } : null;
  47  |     }, row.id),
  48  |     (event) => event?.label === row.label && event.description === row.description,
  49  |     { timeout: 15000, interval: 50, log: 'Wait for the saved Unicode text in Zustand' }
  50  |   );
  51  |   expect(saved).toEqual({ id: row.id, label: row.label, description: row.description });
  52  |   await expect(page.getByTestId(`event-label-${row.id}`)).toHaveText(row.label);
  53  |   await expect(page.getByTestId(`event-description-${row.id}`)).toHaveText(row.description!);
  54  | }
  55  | 
  56  | async function submitEvent(
  57  |   { page, interceptNetworkCall, recurse }: BrowserTools,
  58  |   method: 'POST' | 'PATCH',
  59  |   expected: EventText & { userId: string; date: string; id?: string }
  60  | ): Promise<EventRow> {
  61  |   const write = interceptNetworkCall({ method, url: EVENTS_URL });
  62  |   await page.getByTestId('events-form-submit').click();
> 63  |   const result = await write;
      |                  ^ NetworkTimeoutError: Request timeout while observing network call
  64  |   expect(result.status).toBe(method === 'POST' ? 201 : 200);
  65  |   const rows = method === 'POST'
  66  |     ? [EventRowSchema.parse(result.responseJson)]
  67  |     : EventRowsSchema.parse(result.responseJson);
  68  |   expect(rows).toHaveLength(1);
  69  |   const row = rows[0]!;
  70  |   const textPayload = {
  71  |     label: expected.label, description: expected.description,
  72  |     event_date: expected.date, icon: 'calendar',
  73  |   };
  74  |   expect(result.requestJson).toEqual(method === 'POST'
  75  |     ? { user_id: expected.userId, ...textPayload }
  76  |     : { ...textPayload, updated_at: expect.any(String) });
  77  |   expect(row).toMatchObject({ user_id: expected.userId, ...textPayload });
  78  |   if (method === 'PATCH') {
  79  |     expect(row.id).toBe(expected.id);
  80  |     expect(result.request).not.toBeNull();
  81  |     expect(new URL(result.request!.url()).searchParams.get('id')).toBe(`eq.${expected.id}`);
  82  |   }
  83  |   // Required order: server response, Zustand settlement, rendered row.
  84  |   await expectStoreAndRow(page, recurse, row);
  85  |   await expect(page.getByTestId('events-form')).toHaveCount(0);
  86  |   return row;
  87  | }
  88  | 
  89  | async function reloadAndOpenEdit(tools: BrowserTools, row: EventRow) {
  90  |   const { page, interceptNetworkCall, recurse } = tools;
  91  |   const read = interceptNetworkCall({ method: 'GET', url: EVENTS_URL });
  92  |   await page.reload();
  93  |   expect((await read).status).toBe(200);
  94  |   await expectStoreAndRow(page, recurse, row);
  95  |   await page.getByTestId(`event-edit-${row.id}`).click();
  96  |   await expect(page.getByTestId('events-form-label')).toHaveValue(row.label);
  97  |   await expect(page.getByTestId('events-form-description')).toHaveValue(row.description!);
  98  | }
  99  | 
  100 | function observeEventWrites(page: Page) {
  101 |   const methods: string[] = [];
  102 |   const listener = (request: Request) => {
  103 |     if (new URL(request.url()).pathname === '/rest/v1/events' &&
  104 |       ['POST', 'PATCH', 'DELETE'].includes(request.method())) methods.push(request.method());
  105 |   };
  106 |   // playwright-utils deviation: its single-call interceptor cannot count zero writes across a validation boundary without a timeout; the corrected save is the positive control.
  107 |   page.on('request', listener);
  108 |   return { methods, stop: () => page.off('request', listener) };
  109 | }
  110 | 
  111 | test.beforeEach(async ({ page }) => {
  112 |   await page.addInitScript(() => localStorage.setItem('lastWelcomeView', Date.now().toString()));
  113 | });
  114 | 
  115 | test.describe('Unicode event character limits', () => {
  116 |   for (const [index, initial] of unicodeCases.entries()) {
  117 |     const edited = unicodeCases.find((candidate) => candidate.key !== initial.key)!;
  118 |     test(`[P1] DW83-E2E-00${index + 1} add ${initial.key} then edit ${edited.key} at both limits`, async ({
  119 |       page, coupleEvents, interceptNetworkCall, recurse,
  120 |     }) => {
  121 |       const tools = { page, interceptNetworkCall, recurse };
  122 |       const date = eventDateFrom(coupleEvents.anchor, 30);
  123 |       await log.step('Given an empty event list and padded Unicode text at both limits');
  124 |       await openSettings(tools);
  125 |       await expect(page.getByTestId('events-settings-empty')).toBeVisible();
  126 |       await page.getByTestId('events-settings-add').click();
  127 |       await fillText(page, initial.atLimit);
  128 |       await page.getByTestId('events-form-date').fill(date);
  129 | 
  130 |       await log.step('When Add persists the exact trimmed text, then reload restores its edit values');
  131 |       const created = await submitEvent(tools, 'POST', {
  132 |         ...initial.atLimit, userId: coupleEvents.userId, date,
  133 |       });
  134 |       await reloadAndOpenEdit(tools, created);
  135 | 
  136 |       await log.step('When Edit uses the other Unicode form, then another reload preserves every code point');
  137 |       await fillText(page, edited.atLimit);
  138 |       const updated = await submitEvent(tools, 'PATCH', {
  139 |         ...edited.atLimit, userId: coupleEvents.userId, date, id: created.id,
  140 |       });
  141 |       await reloadAndOpenEdit(tools, updated);
  142 |       await page.getByTestId('events-form-cancel').click();
  143 |     });
  144 |   }
  145 | 
  146 |   for (const mode of ['add', 'edit'] as const) {
  147 |     for (const [fieldIndex, field] of (['label', 'description'] as const).entries()) {
  148 |       const sample = unicodeCases.find((candidate) => candidate.key === (mode === 'add' ? 'emoji' : 'decomposed'))!;
  149 |       const caseId = (mode === 'add' ? 3 : 5) + fieldIndex;
  150 |       test(`[P1] DW83-E2E-00${caseId} ${mode} rejects ${sample.key} ${field} above its limit and saves a correction`, async ({
  151 |         page, coupleEvents, authToken, apiRequest, interceptNetworkCall, recurse,
  152 |       }) => {
  153 |         const tools = { page, interceptNetworkCall, recurse };
  154 |         const date = eventDateFrom(coupleEvents.anchor, 30);
  155 |         const original = { label: 'Unicode original event', description: 'Original description' };
  156 |         const seeded = mode === 'edit'
  157 |           ? (await coupleEvents.seed([{ ...original, dayOffset: 30 }]))[0]!
  158 |           : null;
  159 |         const readPersisted = () => apiRequest<EventRow[]>({
  160 |           method: 'GET', baseUrl: process.env.SUPABASE_URL,
  161 |           path: `/rest/v1/events?select=*&user_id=eq.${coupleEvents.userId}`,
  162 |           headers: { apikey: process.env.SUPABASE_ANON_KEY!, Authorization: `Bearer ${authToken}` },
  163 |         }).validateSchema<EventRow[]>(EventRowsSchema);
```