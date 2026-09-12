---
workflow: bmad-testarch-automate
runKey: dw-activate-parked-event-tests
status: validated
selectedTests: 19
generatedDuplicateTests: 0
generatedFixtures: 0
---

# Prioritized API/E2E Pack — `dw-activate-parked-event-tests`

## Selection result

DW-30 changes test collection and support infrastructure, not product behavior. The active pack
below is the generated selective-execution target for the working-tree change. No new behavioral
spec or fixture was added because each proposed scenario was already covered at the same level.

| Level | P0 | P1 | P2 | P3 | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| API | 1 | 7 | 0 | 0 | 8 |
| E2E | 0 | 6 | 4 | 1 | 11 |
| **Total** | **1** | **13** | **4** | **1** | **19** |

## API tests

| Priority | Test id | Contract protected | File |
| --- | --- | --- | --- |
| P0 | DE.5-API-007 | Anonymous GET/POST privileges are refused and the refused write does not land | `tests/api/events-wire-contract.spec.ts` |
| P1 | DE.5-API-001 | Partner PATCH returns HTTP 200 with zero rows and leaves the creator row untouched | `tests/api/events-write-wire-shape.spec.ts` |
| P1 | DE.5-API-002 | Partner DELETE returns HTTP 200 with zero rows and leaves the creator row present | `tests/api/events-write-wire-shape.spec.ts` |
| P1 | DE.5-API-003 | Creator PATCH returns exactly one updated row | `tests/api/events-write-wire-shape.spec.ts` |
| P1 | DE.5-API-004 | POST representation preserves the date string and applies column defaults | `tests/api/events-wire-contract.spec.ts` |
| P1 | DE.5-API-005 | Pair rows are returned in date/creation order | `tests/api/events-wire-contract.spec.ts` |
| P1 | DE.5-API-006 | A 101-character label is refused by the mirrored CHECK constraint | `tests/api/events-wire-contract.spec.ts` |
| P1 | DE.5-API-008 | An unlinked outsider sees no pair rows; pair cleanup preserves the outsider row | `tests/api/events-wire-contract.spec.ts` |

## E2E tests

| Priority | Test id | Journey protected | File |
| --- | --- | --- | --- |
| P1 | DE.5-E2E-001a | Settled Settings events section is axe-clean | `tests/e2e/settings/events-accessibility.spec.ts` |
| P1 | DE.5-E2E-001b | Open event form dialog is axe-clean | `tests/e2e/settings/events-accessibility.spec.ts` |
| P1 | DE.5-E2E-001c | Open delete confirmation is axe-clean | `tests/e2e/settings/events-accessibility.spec.ts` |
| P1 | DE.5-E2E-001d | Empty events section is axe-clean | `tests/e2e/settings/events-accessibility.spec.ts` |
| P1 | DE.5-E2E-004 | Selected icon survives reload and reaches the Home card | `tests/e2e/settings/events-persistence.spec.ts` |
| P1 | DE.5-E2E-005 | Reloaded rows render in server order | `tests/e2e/settings/events-persistence.spec.ts` |
| P2 | DE.5-COMP-003 | Reconnect re-fires the failed Settings load without a page reload | `tests/e2e/settings/events-load-recovery.spec.ts` |
| P2 | DE.5-E2E-002a | Rejected edit keeps the form open with the service message | `tests/e2e/settings/events-write-failures.spec.ts` |
| P2 | DE.5-E2E-002b | Rejected delete keeps confirmation open with the service message | `tests/e2e/settings/events-write-failures.spec.ts` |
| P2 | DE.5-E2E-006 | Clearing a description persists `null` through Settings and Home | `tests/e2e/settings/events-persistence.spec.ts` |
| P3 | DE.5-E2E-003 | Offline save exposes the service offline message | `tests/e2e/settings/events-write-failures.spec.ts` |

## Fixture contract

- Import `test` and `expect` from `tests/support/merged-fixtures.ts`.
- Reuse `tests/support/helpers/events.ts` for the activated single-row seed and checked pair cleanup.
- Reuse the existing `coupleEvents` fixture from `tests/support/fixtures/index.ts` when new tests
  need pair ids, a shared date anchor, batch seeding, or automatic before/after cleanup.
- Do not add another event harness. The active API outsider case already proves cleanup isolation.

The remaining P3 midnight-anchor debt in `isoDateDaysFromNow` should be fixed by accepting one
anchor and unit-testing the pure date mapping. A timing-sensitive API/E2E race test is not an
appropriate substitute.

## Commands

```bash
npx playwright test tests/api/events-write-wire-shape.spec.ts tests/api/events-wire-contract.spec.ts --project=api --workers=2
npx playwright test tests/e2e/settings/events-accessibility.spec.ts tests/e2e/settings/events-load-recovery.spec.ts tests/e2e/settings/events-write-failures.spec.ts tests/e2e/settings/events-persistence.spec.ts --project=chromium --workers=1
```
