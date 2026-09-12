# Prioritized regression selection

All 11 cases are reused unchanged. There is no new runtime behavior or assertion
coverage to add for DW-73/77/82. The snapshots are reference artifacts; `run.py`
checks source equality and runs each canonical file once in its existing project.
Priorities describe the underlying behavior, not the risk of editing a comment.

Confidence: 9/10. Rationale: source, existing assertions, fixture composition,
and the bundle specification provide concrete evidence; discovery and execution
confirmed all selected cases. Unknowns: multi-browser and sustained concurrency
behavior are outside this run.

| Priority | ID | Project | Assertion scope | Limit |
| --- | --- | --- | --- | --- |
| P0 | DW-75-E2E-001 | chromium | Signed-out and returned-same-account lifetimes reject retained old callbacks; current callback updates store and badge. | Local identities and controlled service callbacks; no sign-in form, Supabase auth event, or live Realtime transport. |
| P0 | DW-75-E2E-002 | chromium | Account switch clears prior account records; late old callback cannot contaminate the new account store or badge. | Exercises production state and rendered badge through a browser harness, not authenticated server delivery. |
| P1 | DE.5-E2E-004 | chromium | Ring selection survives reload into edit-form prefill and Home Gem/amber rendering. | One selected icon; no claim that every icon is covered. |
| P1 | DE.5-E2E-005 | chromium | Three distinct future dates display chronologically after reload. | Display order cannot identify the sorting layer; same-date created_at ties are not exercised. |
| P1 | DW-75-E2E-003 | chromium | Same-user refresh preserves callback delivery and current records; duplicate IDs do not inflate counts; viewed records do not increase unread counts. | The refresh is direct setAuthUser invocation; no token-refresh protocol or Supabase auth-event wiring assertion. |
| P1 | DW39-API-001 | api | a null message produces a contextual database fallback | Controlled SDK response; not live PostgREST or every selective caller. |
| P1 | DW39-API-002 | api | Unicode whitespace uses the fallback and retains null diagnostics | Controlled SDK response; not live PostgREST or every selective caller. |
| P2 | DE.5-E2E-006 | chromium | Pass-through PATCH carries description:null and returns HTTP 200; Settings and Home remove the description. | No reload follows the clear; separate post-reload durability is not asserted. |
| P2 | DW39-API-003 | api | CHECK mapping takes precedence over an empty SDK message | Controlled SDK response; not live PostgREST or every selective caller. |
| P2 | DW39-API-004 | api | meaningful message whitespace survives SDK parsing and conversion | Controlled SDK response; not live PostgREST or every selective caller. |
| P2 | DW39-API-005 | api | a numeric SDK message retains compatibility without throwing | Controlled SDK response; not live PostgREST or every selective caller. |

The 84 existing mapper unit cases and 6 interaction-subscription unit cases are
supporting lower-level evidence, separate from the 11 API/browser cases. Caller
integration suites for photos, notes, partner requests and reflections were
inspected and cataloged in `api-context.md`; this run does not claim to execute them.

No Pact, schema, authentication provider, endpoint or selector was invented.
Existing ATDD and event design context describe the broader feature; this pack
selects only evidence relevant to the corrected headers. Same-date API wire order
and description durability after reload are separate from the selected display
and PATCH assertions. No changed-behavior gap remains in this documentation bundle.
