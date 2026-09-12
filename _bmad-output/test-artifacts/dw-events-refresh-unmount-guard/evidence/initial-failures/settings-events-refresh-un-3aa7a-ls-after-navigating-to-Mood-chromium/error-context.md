# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/settings/events-refresh-unmount.spec.ts >> DW-57 events refresh and retry across Settings unmount >> [P1] DW-57-E2E-002 stale delete refresh fails after navigating to Mood
- Location: tests/e2e/settings/events-refresh-unmount.spec.ts:131:3

# Error details

```
RecurseTimeoutError: Recursion timed out without finding a value that satisfies the predicate (15000ms timeout exceeded)
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
      - generic [ref=e14]:
        - button "Log Mood" [ref=e15]
        - button "Timeline" [ref=e17]
        - button "Calendar" [ref=e19]
      - generic [ref=e22]:
        - generic [ref=e23]:
          - heading "How are you feeling?" [level=1] [ref=e24]
          - paragraph [ref=e25]: Track your mood for today
        - generic [ref=e26]:
          - generic [ref=e27]: 💭
          - heading "No mood logged yet" [level=3] [ref=e28]
          - paragraph [ref=e29]: Check in with your partner to see how they're feeling ❤️
        - generic [ref=e30]: Online
        - generic [ref=e34]:
          - generic [ref=e35]:
            - generic [ref=e36]: How are you feeling? (select all that apply)
            - generic [ref=e37]:
              - paragraph [ref=e38]: Positive
              - generic [ref=e39]:
                - button "Loved mood" [ref=e40]:
                  - generic [ref=e43]: Loved
                - button "Happy mood" [active] [ref=e44]:
                  - generic [ref=e48]: Happy
                - button "Content mood" [ref=e49]:
                  - generic [ref=e52]: Content
                - button "Excited mood" [ref=e53]:
                  - generic [ref=e56]: Excited
                - button "Thoughtful mood" [ref=e57]:
                  - generic [ref=e60]: Thoughtful
                - button "Grateful mood" [ref=e61]:
                  - generic [ref=e65]: Grateful
            - generic [ref=e66]:
              - paragraph [ref=e67]: Challenging
              - generic [ref=e68]:
                - button "Sad mood" [ref=e69]:
                  - generic [ref=e73]: Sad
                - button "Anxious mood" [ref=e74]:
                  - generic [ref=e77]: Anxious
                - button "Frustrated mood" [ref=e78]:
                  - generic [ref=e84]: Frustrated
                - button "Angry mood" [ref=e85]:
                  - generic [ref=e91]: Angry
                - button "Lonely mood" [ref=e92]:
                  - generic [ref=e96]: Lonely
                - button "Tired mood" [ref=e97]:
                  - generic [ref=e100]: Tired
          - button "+ Add note (optional)" [ref=e102]
          - button "Log Mood" [disabled] [ref=e103]
```

# Test source

```ts
  1   | /**
  2   |  * DW-57 browser integration: actual navigation while Refresh/Retry owns both
  3   |  * pending events GETs, shared-store settlement, remount recovery, native focus.
  4   |  * Zero post-unmount React setter calls are proved by the component lifetime
  5   |  * suite; browser silence cannot observe those calls because React discards them.
  6   |  */
  7   | import type { Page } from '@playwright/test';
  8   | import { log } from '@seontechnologies/playwright-utils';
  9   | import { recurse } from '@seontechnologies/playwright-utils/recurse';
  10  | import { test, expect } from '../../support/merged-fixtures';
  11  | import type { EventsRefreshControl } from '../../support/fixtures/events-refresh-control';
  12  | import { navigateTo } from '../../support/helpers/navigation';
  13  | 
  14  | const expectedLoadFailure = { annotation: [{ type: 'skipNetworkMonitoring' }] };
  15  | 
  16  | async function eventsSnapshot(page: Page) {
  17  |   return page.evaluate(() => {
  18  |     const state = window.__APP_STORE__!.getState();
  19  |     return {
  20  |       ids: state.events.map((event) => event.id).sort(),
  21  |       loading: state.eventsIsLoading,
  22  |       error: state.eventsError,
  23  |       view: state.currentView,
  24  |     };
  25  |   });
  26  | }
  27  | 
  28  | async function openSettings(page: Page, control: EventsRefreshControl) {
  29  |   await page.goto('/settings');
  30  |   // Two loads (four GETs) on first mount under the app's real StrictMode.
  31  |   await control.waitForIdle();
  32  |   await expect(page.getByTestId('settings-view')).toBeVisible();
  33  |   await expect(page.getByTestId('events-settings-loading')).toHaveCount(0);
  34  |   await expect(page.getByTestId('events-settings-load-region')).toHaveAttribute('aria-busy', 'false');
  35  | }
  36  | 
  37  | async function openFailedSettings(page: Page, control: EventsRefreshControl) {
  38  |   const initialLoad = control.holdNextLoad('failure');
  39  |   await page.goto('/settings');
  40  |   await initialLoad.waitForPending(2);
  41  |   initialLoad.release();
  42  |   expect(await initialLoad.waitForCompleted()).toEqual([503, 503, 503, 503]);
  43  |   await control.waitForIdle();
  44  |   await expect(page.getByTestId('events-settings-load-error')).toBeVisible();
  45  |   await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeEnabled();
  46  | }
  47  | 
  48  | async function leaveForMood(page: Page) {
  49  |   // Home also calls loadEvents and could supersede the pending load under test.
  50  |   await navigateTo(page, 'mood');
  51  |   await expect(page.getByTestId('mood-tracker')).toBeVisible();
  52  |   await expect(page.getByTestId('events-settings')).toHaveCount(0);
  53  |   await page.getByRole('button', { name: 'Happy mood', exact: true }).focus();
  54  | }
  55  | 
  56  | async function expectSettledOnMood(page: Page, ids: string[], failed: boolean) {
> 57  |   await recurse(
      |   ^ RecurseTimeoutError: Recursion timed out without finding a value that satisfies the predicate (15000ms timeout exceeded)
  58  |     () => eventsSnapshot(page),
  59  |     (state) => {
  60  |       expect(state.loading).toBe(false);
  61  |       expect(state.ids).toEqual([...ids].sort());
  62  |       if (failed) expect(state.error).toBeTruthy();
  63  |       else expect(state.error).toBeNull();
  64  |       expect(state.view).toBe('mood');
  65  |     },
  66  |     { timeout: 15000, interval: 50, log: 'Waiting for shared events store after Settings unmount' }
  67  |   );
  68  |   await expect(page.getByTestId('mood-tracker')).toBeVisible();
  69  |   await expect(page.getByRole('button', { name: 'Happy mood', exact: true })).toBeFocused();
  70  |   await expect(page.getByTestId('events-settings-load-error')).toHaveCount(0);
  71  | }
  72  | 
  73  | async function returnToRecoveredSettings(page: Page, witnessId: string, missingId?: string) {
  74  |   await navigateTo(page, 'settings');
  75  |   await recurse(
  76  |     () => eventsSnapshot(page),
  77  |     (state) => !state.loading && state.error === null &&
  78  |       state.ids.includes(witnessId) && (!missingId || !state.ids.includes(missingId)),
  79  |     { timeout: 15000, interval: 50, log: 'Waiting for fresh Settings mount recovery' }
  80  |   );
  81  |   await expect(page.getByTestId(`event-row-${witnessId}`)).toBeVisible();
  82  |   if (missingId) await expect(page.getByTestId(`event-row-${missingId}`)).toHaveCount(0);
  83  |   await expect(page.getByTestId('events-settings-load-error')).toHaveCount(0);
  84  |   await expect(page.getByRole('button', { name: 'Add event', exact: true })).toBeEnabled();
  85  | }
  86  | 
  87  | test.beforeEach(async ({ page }) => {
  88  |   await page.addInitScript(() => {
  89  |     localStorage.setItem('lastWelcomeView', Date.now().toString());
  90  |   });
  91  | });
  92  | 
  93  | test.describe('DW-57 events refresh and retry across Settings unmount', () => {
  94  |   test('[P1] DW-57-E2E-001 stale edit refresh succeeds after navigating to Mood', async ({
  95  |     page, coupleEvents, eventsRefreshControl, apiRequest, authToken, interceptNetworkCall,
  96  |   }) => {
  97  |     const [stale, witness] = await coupleEvents.seed([
  98  |       { label: 'DW57 stale edit', dayOffset: 14 },
  99  |       { label: 'DW57 edit survivor', dayOffset: -14 },
  100 |     ]);
  101 |     await log.step('Open a creator event, then remove its server row outside the stale UI');
  102 |     await openSettings(page, eventsRefreshControl);
  103 |     await expect(page.getByTestId(`event-row-${stale.id}`)).toBeVisible();
  104 |     const removed = await apiRequest({
  105 |       method: 'DELETE', baseUrl: process.env.SUPABASE_URL,
  106 |       path: `/rest/v1/events?id=eq.${stale.id}`,
  107 |       headers: { apikey: process.env.SUPABASE_ANON_KEY!, Authorization: `Bearer ${authToken}` },
  108 |     });
  109 |     expect(removed.status).toBe(204);
  110 |     const rejectedWrite = interceptNetworkCall({ method: 'PATCH', url: '**/rest/v1/events*' });
  111 |     await page.getByTestId(`event-edit-${stale.id}`).click();
  112 |     await page.getByTestId('events-form-label').fill('DW57 attempted stale edit');
  113 |     await page.getByRole('button', { name: 'Update', exact: true }).click();
  114 |     const rejected = await rejectedWrite;
  115 |     expect(rejected.status).toBe(200);
  116 |     expect(rejected.responseJson).toEqual([]);
  117 |     await expect(page.getByTestId('events-form-error')).toContainText('Event not found or not yours to edit');
  118 | 
  119 |     await log.step('Hold both Refresh reads, then unmount Settings through navigation');
  120 |     const refresh = eventsRefreshControl.holdNextLoad('success');
  121 |     await page.getByRole('button', { name: 'Refresh events', exact: true }).click();
  122 |     await refresh.waitForPending();
  123 |     await expect(page.getByTestId('events-form')).toHaveCount(0);
  124 |     await leaveForMood(page);
  125 |     refresh.release();
  126 |     expect(await refresh.waitForCompleted()).toEqual([200, 200]);
  127 |     await expectSettledOnMood(page, [witness.id], false);
  128 |     await returnToRecoveredSettings(page, witness.id, stale.id);
  129 |   });
  130 | 
  131 |   test('[P1] DW-57-E2E-002 stale delete refresh fails after navigating to Mood', expectedLoadFailure, async ({
  132 |     page, coupleEvents, eventsRefreshControl, apiRequest, authToken, interceptNetworkCall,
  133 |   }) => {
  134 |     const [stale, witness] = await coupleEvents.seed([
  135 |       { label: 'DW57 stale delete', dayOffset: 14 },
  136 |       { label: 'DW57 delete survivor', dayOffset: -14 },
  137 |     ]);
  138 |     await log.step('Keep a stale creator row rendered after an actual server deletion');
  139 |     await openSettings(page, eventsRefreshControl);
  140 |     await expect(page.getByTestId(`event-row-${stale.id}`)).toBeVisible();
  141 |     const removed = await apiRequest({
  142 |       method: 'DELETE', baseUrl: process.env.SUPABASE_URL,
  143 |       path: `/rest/v1/events?id=eq.${stale.id}`,
  144 |       headers: { apikey: process.env.SUPABASE_ANON_KEY!, Authorization: `Bearer ${authToken}` },
  145 |     });
  146 |     expect(removed.status).toBe(204);
  147 |     const rejectedWrite = interceptNetworkCall({ method: 'DELETE', url: '**/rest/v1/events*' });
  148 |     await page.getByTestId(`event-delete-${stale.id}`).click();
  149 |     await page.getByTestId('events-delete-confirm').click();
  150 |     const rejected = await rejectedWrite;
  151 |     expect(rejected.status).toBe(200);
  152 |     expect(rejected.responseJson).toEqual([]);
  153 |     await expect(page.getByTestId('events-delete-error')).toContainText('Event not found or not yours to delete');
  154 | 
  155 |     await log.step('Let a failed Refresh settle after Settings has unmounted');
  156 |     const refresh = eventsRefreshControl.holdNextLoad('failure');
  157 |     await page.getByRole('button', { name: 'Refresh events', exact: true }).click();
```