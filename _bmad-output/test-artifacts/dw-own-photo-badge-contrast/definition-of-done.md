---
story: dw-own-photo-badge-contrast
workflow: bmad-testarch-automate
status: done
date: '2026-09-12'
---

# DW-59 Definition of Done

Scope: implementation `6a70ad55` on HEAD `96b03a2f`, compared with `172f1b5d`.
Generated automation is retained under TEA's configured `_bmad-output/test-artifacts` directory.

| Acceptance | Generated checks | Priority |
| --- | --- | --- |
| Loaded white photo, white label, opaque existing pink, contrast >=4.5:1 in both themes | DW59-E2E-001-light / dark | P1 |
| Preserve own/partner labels, icon, spacing, top-right placement and image behavior | DW59-E2E-002-light / dark | P2 |
| Preserve caption hover and one selection callback per click, Enter and Space | DW59-E2E-002-light / dark | P2 |

API scenarios: **0, not applicable**. No API contract changed, and an API test cannot measure
browser compositing. This decision is independently supported by `workers/api.json`.
No Pact contract or unit test is needed for this CSS-only change.

## Validation

| Check | Result | Evidence |
| --- | --- | --- |
| Initial Chromium run, one worker | 4/4 passed in 9.1 seconds | `validation/initial-run.txt`, `validation/initial-results.json` |
| Original-opacity negative control | Both P1 cases failed specifically at contrast >=4.5, as intended | `validation/baseline-run.txt`, `validation/baseline-results.json` |
| Final Chromium run through run.py, two workers | 4/4 passed in 6.3 seconds; no skips, retries, or flakes | `validation/final-run.txt`, `validation/final-results.json` |
| Full typecheck with final files activated | Passed, all referenced projects | `validation/typecheck-final.txt` |
| Full lint with final files activated | Passed; only three existing EventCountdown Fast Refresh warnings | `validation/lint-final.txt` |
| Artifact integrity, cleanup, protected-file hashes, mandate patterns | Passed | `validation/hygiene.json` |
| Visual inspection | Loaded white thumbnail and readable pink You badge inspected | `validation/loaded-white-light.png` |

The final bundle contains **4 unique tests: 2 P1 and 2 P2**, all executed in Chromium. The initial
and final runs each passed those same four cases; they are not eight distinct coverage scenarios.
The two negative-control failures are intentional evidence, not unresolved suite failures.
Machine-readable counts are in `validation/results.json`.

Current light/dark measurements are identical: foreground `[255,255,255,255]`, pink background
`[230,0,118,255]`, decoded image pixel `[255,255,255,255]`, all ancestor opacities 1, and
**4.5393627491477275:1** contrast. JSON evidence is in `validation/contrast-light.json` and
`validation/contrast-dark.json`; the matching PNG captures are retained beside them.

For the negative control, the harness temporarily imported PhotoGridItem from baseline `172f1b5d`,
with only its relative service/logger imports relocated for the temporary path. The production
source was never edited. Both P1 tests measured **4.28750627651904:1**, with background alpha
230/255 and a white-photo composite `[232,25,131,255]`, then failed the exact >=4.5 assertion.
The helper uses browser sRGB canvas source-over compositing and 8-bit channels; its translucent
rounding differs slightly from the earlier spec's screenshot-based 4.27515 result. Both are below
the threshold. The opaque current result matches the spec. No rounding tolerance weakens the gate.

Validation refinements: the factory now accepts typed overrides, the contrast assertion precedes
palette/alpha checks to expose the negative control directly, and exporting the harness component
removed its initial Fast Refresh warning. The final test run, lint, and typecheck use these final
files. Worker JSON preserves original generation proposals; generation-summary.json records the
final validated file hashes.

## Completion checklist

- [x] The exact change and spec were read; existing test gaps were identified.
- [x] Four cases have explicit priorities and acceptance mapping.
- [x] The API worker completed the applicability assessment without inventing endpoints.
- [x] Existing merged fixtures, auth opt-out, and network monitor are reused.
- [x] The artifact runner provides repeatable activation and cleanup without overwriting files.
- [x] Generated tests execute successfully and have no skips, focus, hard waits, or hidden failures.
- [x] The contrast checks reject the old translucent appearance.
- [x] Activated TypeScript and lint checks pass.
- [x] All retained generated files match validated content.
- [x] Temporary activation copies are removed and orchestrator-owned files are preserved.

## Scope and limitations

These are browser component tests discovered by the existing Chromium E2E project. They exercise
the real PhotoGridItem and stylesheet with decoded bright PNG fixtures, rather than authentication,
upload, signing, or gallery navigation. The isolated harness cannot certify gallery-ancestor
styling changes. Other browsers and full app accessibility are outside this change's claim.

The artifacts are runnable with `run.py`; default CI does not discover them while they remain in
test_artifacts. The source implementation remains unchanged by this workflow. Permanent promotion
and CI execution are separate from this generation request.

Playwright Utils deviations: none. Network/API interception, API factories, download
helpers, HAR capture, and server cleanup are not needed for browser-local image fixtures.
Deterministic semantic image pixels and visual dimensions are intentional fixture literals;
the final data factory has complete typed records and override support. Non-API font stylesheet
traffic is stubbed to make layout assertions independent of external font availability.

The contrast margin is only about 0.039 above 4.5; future palette changes should run these tests.
This run does not claim a full CI pass or production-build validation. No production code changed
during automation, so validation targets generated tests and their actual browser rendering.

No changes to shared package scripts or tests/README.md are needed: the bundle README documents
its additional activation requirement, and the project already exposes the required runner,
priority selection, lint, and full typecheck commands.

Next recommended workflow: `bmad-testarch-trace` to incorporate this evidence into traceability.
