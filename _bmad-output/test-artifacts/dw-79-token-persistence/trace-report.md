# DW-79: Executed token persistence characterization

Executed on 2026-09-12 against production baseline `cd1a693d8e1a9f4ffc6b295d2dbd2d26cea8a758`. All five controlled Chromium schedules passed. Three schedules demonstrate stale persistence after a newer token commits. The ordinary overlapping local-action control finishes with the newer sign-in token.

These results support a later persistence-coordination change: duplicate action persistence can delete or replace a newer notification's committed token. This bundle selects and implements no coordination mechanism.

## Observed outcomes

Arrows below are native `IDBTransaction.complete` event order. Setup writes and verification reads are omitted from the abbreviated order; the linked JSON retains every observed operation. `A/v1`, `A/v2`, and `B/v1` are synthetic labels, and `null` is the result of actual `getAuthToken()`.

| Scenario | Native persistence commit order | Final storage | Finding |
| --- | --- | --- | --- |
| [Sequential](evidence/sequential.json) | Sign-in listener puts A/v1 → sign-in action puts A/v1 → sign-out listener deletes → sign-out action deletes | A/v1 after sign-in; null after sign-out | Duplicate writes and deletes both commit normally. |
| [Overlapping local actions](evidence/local-actions.json) | Sign-out listener deletes → B sign-in listener puts B/v1 → sign-out action deletes → B sign-in action puts B/v1 | B/v1 | The stale delete occurs, then the newer local action restores B. |
| [Stale clear](evidence/stale-clear.json) | Sign-out listener deletes → independent B notification puts B/v1 → sign-out action deletes | null | Older action persistence deletes the newer committed token. |
| [Stale overwrite](evidence/stale-overwrite.json) | A sign-in listener puts A/v1 → independent B notification puts B/v1 → A sign-in action puts A/v1 | A/v1 | Older action persistence replaces B with A. B is an independent notification, not another local sign-in action. |
| [Same-owner refresh](evidence/same-owner-refresh.json) | A sign-in listener puts A/v1 → TOKEN_REFRESHED notification puts A/v2 → A sign-in action puts A/v1 | A/v1 | Owner identity alone hides the stale token version; the refreshed version is lost. |

The retained stale-clear trace makes the causal order explicit: B's listener transaction is created at sequence 32; the older listener commits at 37; its notification completes before the controlled SDK response at 40; the action's duplicate delete is dispatched at 41 and its transaction is created at 44. B commits at 46, then the action delete commits at 50. The actual final read observes null at 60.

In both stale-overwrite and same-owner-refresh, the newer listener transaction is created at sequence 14. The original listener commits at 19, the controlled SDK responds at 22, and the original action dispatches its duplicate write at 23, creating its transaction at 26. The newer write commits at 28, followed by the stale action write at 32. The final read observes A/v1 at 42.

In the local-action control, B's listener commits at 48, the stale sign-out action delete commits at 57, and B's own action put commits at 61. The final read observes B/v1 at 71. This control is essential: the evidence does not claim that this ordinary pair of local actions leaves final storage empty.

Every scenario's transaction creation order matches its native completion order. The stale outcomes follow later dispatch of duplicate action transactions. No open success, request success, or native completion is delayed or reordered by the observers. In these retained traces, the stale action transaction is created before the newer write's completion event, but its mutation commits afterward; this is not evidence that an already-created older transaction overtook a newer one.

## Harness and evidence boundary

The browser loads the actual `actionService.signIn/signOut`, `sessionService.onAuthStateChange`, `sw-db` helpers, installed `idb`, and the shared schema's `DB_NAME`, `DB_VERSION`, `STORE_NAMES`, and `upgradeDb`. There is no App UI, mocked sw-db, fake IndexedDB, schema modification, or server data mutation.

Only `supabase.auth.signInWithPassword`, `signOut`, and `onAuthStateChange` are temporarily substituted. Each controlled SDK action invokes its originating real sessionService callback and awaits that callback's full completion before returning the action response. The tests assert native listener commit → notification completion → SDK response → duplicate action persistence → action completion for every local action.

A native readwrite transaction on `sw-auth` repeatedly queues reads from each preceding request's success handler. The harness waits until both listener transactions have been created behind that blocker, then stops queuing reads. It does not delay database open events or resolve fake storage promises. Tests assert both listener transactions were created before release and completed after the blocker's native completion.

Native wrappers record synchronous persistence dispatch at `indexedDB.open`, real open success, transaction creation, request dispatch/success, native transaction completion, and production connection close. Listener/read provenance is captured synchronously when calling the real service. For action continuations, a browser-local stack check identifies the actual `actionService.ts` sign-in/sign-out caller and associates it with the single active action of that method. The stack is never exported. This harness deliberately supports at most one active action of each method; it does not claim coverage of multiple concurrent sign-ins. Each actual put is checked against the in-memory synthetic session, including both token fields, owner and expiry. Reads use actual `getAuthToken()` and validate the stored record against the same private mapping before exporting a label.

The `sequence` field is an observation ordinal, not elapsed time. `operation` identifies a production open/connection lifetime, or the blocker. `transaction` identifies a native transaction. Read-operation rows carry `token: null` until the `storage-observed` row; that placeholder does not mean the read returned null. `checkpoints` and `finalToken` hold the observed read results.

Each spec imports merged fixtures and sets `authSessionEnabled: false`, obtaining a fresh anonymous browser context. The isolated config imports the project's existing local environment bootstrap, disables global worker provisioning, runs Chromium alone, and launches a fresh Vite process on `127.0.0.1:5189` with strict port binding. The harness refuses pre-existing application IndexedDB or local-storage data. Network interception rejects and counts requests outside that origin. All five executions recorded zero external requests and zero page errors.

Cleanup releases contention, drains every dispatched action and notification and every observed native transaction, unsubscribes the harness listener, restores the three SDK methods and all native/console instrumentation, closes remaining connections, and deletes the isolated database. All five retained traces report successful drain, restoration, and database removal, with no service errors, request errors or transaction aborts. An unexpected error, missing phase, mismatched provenance, unclosed production connection, or unsettled action fails characterization.

The JSON attachment and retained evidence contain only synthetic owner/version labels and operation/ordering metadata, plus runtime versions and cleanup checks. Access tokens, refresh tokens, user IDs, credentials, request headers, URLs, SDK payloads, stacks, and raw error messages are not serialized. Raw Playwright traces, screenshots and videos are disabled for this spec. Ordinary E2E runs attach the JSON; only the isolated config opts into writing passing JSON files into this bundle's `evidence/` directory.

## Runtime and verification

| Runtime | Executed version |
| --- | --- |
| Node | v24.19.0 |
| Playwright | 1.63.0 |
| Chromium | 153.0.8010.12 |
| idb | 8.0.3 |
| @supabase/supabase-js | 2.116.0 |
| @supabase/auth-js | 2.116.0 |
| Vite | 8.2.2 |

From the repository root, with dependencies and Chromium installed and the existing local Supabase stack running:

```sh
npx playwright test --config _bmad-output/test-artifacts/dw-79-token-persistence/playwright.verify.config.ts
npm run typecheck
npm run lint
npx vitest run src/api/auth/__tests__/authServices.test.ts
git diff --check
git diff --exit-code cd1a693d8e1a9f4ffc6b295d2dbd2d26cea8a758 -- src/api/auth/actionService.ts src/api/auth/sessionService.ts src/sw-db.ts src/services/dbSchema.ts src/types/database.types.ts mise.lock _bmad-output/implementation-artifacts/deferred-work.md
```

The browser execution passed all five scenarios in 2.7 seconds and produced the retained JSON. Final typecheck passed. Existing auth service contracts passed 17/17. Final lint passed with zero errors and the three existing Fast Refresh warnings in `EventCountdown.tsx`. `git diff --check` passed, and the baseline comparison confirmed the production auth services, sw-db, schema, generated files and deferred-work ledger are unchanged. No requested implementation or verification remains incomplete.

`npm run typecheck` and `npm run lint` cover the included source and tests. The isolated Playwright config is outside the TypeScript project includes and excluded by lint rules; its validation comes from Playwright loading the config and running its five tests, not from those static checks.

## Inference limits

The installed `@supabase/auth-js/src/GoTrueClient.ts` was inspected directly: `signInWithPassword` saves the session and awaits `_notifyAllSubscribers('SIGNED_IN', ...)` before returning (around lines 1239–1295); default-scope `signOut` goes through `_removeSession`, which awaits the SIGNED_OUT notification (around 4067–4123 and 5268–5285); `_notifyAllSubscribers` awaits subscriber callbacks with `Promise.all` (around 5170–5217). Its initialization path may enqueue notifications, and sign-out can use a configured lock. The installed source also has an incoming BroadcastChannel delivery path. Those surrounding mechanisms are not executed by the controlled SDK substitutes. The [Supabase notification API documentation](https://supabase.com/docs/reference/javascript/auth-onauthstatechange) was checked for the public callback contract; source-specific ordering conclusions here come from the installed code.

The installed `idb/build/index.js` convenience write implementation awaits both request completion and `tx.done`; the latter resolves from the native transaction `complete` event. Its convenience read awaits request success, so the harness additionally drains the read transaction's native completion before exporting a checkpoint.

This is single-context Chromium evidence about real persistence under controlled callback/action-response schedules. It does not establish that a live server, SDK initialization, automatic refresh, configured SDK lock, or multiple tabs will produce these schedules or how often they would occur. The same-owner refresh and independent B notification are explicitly injected at the callback boundary. No browser other than the recorded Chromium version, worker sync request, server token validity, crash/power-loss durability, or live multi-tab schedule was tested. A later coordination decision should retain these proven persistence outcomes while evaluating the live scheduling conditions separately.
