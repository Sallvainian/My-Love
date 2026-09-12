---
story: dw-auth-bootstrap-notification-order
workflow: bmad-testarch-automate
date: '2026-09-12'
status: done
runtime_evidence: pass
static_evidence: pass
mutation_evidence: pass
source_snapshot_evidence: pass
---

# Workflow checklist validation

Validated against `.agents/skills/bmad-testarch-automate/checklist.md`. PASS means the named evidence supports the scoped claim; N/A identifies work this change does not require. Orchestrator status was never used as verification evidence.

| Requirement group | Result | Evidence or scope disposition |
| --- | --- | --- |
| Framework and context | PASS | Existing Playwright/Vitest configs and dependencies; BMad-integrated Create mode; implemented DW-81 spec and actual source loaded. |
| Knowledge and utility flags | PASS | `knowledge-loaded.json` records full core/UI/API reads and delegated provenance. Installed Playwright Utils binds the generated code. |
| Existing coverage and targets | PASS | Existing unit matrix inspected; seven browser scenarios plus one complementary API identity scenario mapped to the spec. |
| Mode resolution and worker outputs | PASS | Native subagents verified; API/E2E workers completed valid JSON outputs, retained under `workers/`. No fabricated parallel speedup. |
| Priorities and levels | PASS | 3 P0 account/session replacement cases, 5 P1 continuity/controls/API cases. Existing units keep cleanup permutations; API does not claim to prove App ordering. |
| Test discovery and execution | PASS | 8 discovered/selected/passed initially; 40/40 across five fresh invocations; zero retries, skips or flaky results. See `evidence/initial.json` and `repeat-summary.json`. |
| Fixture composition | PASS | One existing merged-fixtures entry point, extended with authBootstrap; both specs import it. |
| Data and isolation | PASS | Read-only worker identities for API; overrideable synthetic session/event factories and fresh browser contexts for SDK ordering. No persistent account mutation. |
| Fixture lifecycle | PASS | Unmount, retire auth ownership, release held promises, await delivery settlement, restore SDK/service/store/welcome state; existing context fixture closes the context. |
| Test structure and selectors | PASS | Named priority-tagged cases with visible setup/action/outcome stages; test IDs and accessible names confirmed in source and successful runtime assertions. |
| Store/UI synchronization | PASS | Controlled SDK completion, auth loading disappearance, exact store ownership/call counts and rendered UI. Original event request settles through real eventsSlice before final card assertions. |
| Network/utility mandate | PASS | API uses apiRequest and chained Zod validation; waits use recurse; logging uses log.step; existing network monitor retained. Two documented SDK/auth control deviations. |
| Response schema | PASS | Minimum local identity/audience/metadata schema, exact independently resolved UUID/email expectations, explicit scope limit on full upstream response. |
| Static quality | PASS | Typecheck; lint zero errors/three existing warnings; no focused/skipped tests, timing sleeps, raw HTTP substitutions or extra entrypoints. |
| Existing regressions | PASS | 59 focused App/service/store units passed. `evidence/unit.json` includes suite counts. |
| Falsifiability | PASS | Removing the guard breaks three P0 UI outcomes; ignoring null notifications breaks first-null Login. Intentional failures are separate from passing results. |
| Repetition | PASS | Five separate test invocations with fresh processes and zero retries, not a ten-run or CI stability claim. |
| Source restoration and snapshots | PASS | Original protected hashes match; seven active snapshots match exercised source. See `source-manifest.json` and `evidence/integrity.json`. |
| Artifact and browser hygiene | PASS | Named CLI session closed; own strict-port server managed by runner; tracked evidence omits credential-bearing configuration/payloads; raw reports remain ignored. |
| README, summary and DoD | PASS | Scoped README gives exact local and owned-CI commands; story summary, Definition of Done, deviations, inventory and limitations completed. |
| Orchestrator state | PASS | Initial ledger bytes preserved. Sprint-status absent and never created/written/reverted. Completion marker is emitted after final validation. |
| ATDD/test-design/PRD expansion | N/A | No story-specific ATDD/design input exists; the frozen deferred-work spec supplies this bounded scope. No extra workflows invoked. |
| Generic CRUD/error/JWT/Pact matrices | N/A | No server endpoint changed; no new persistence or service contract. Existing token provider and actual Auth response validate identities without inventing unrelated suites. |
| Generic database/product fixtures, HAR/webhooks/downloads | N/A | No corresponding feature in scope. Synthetic SDK interleavings cannot be represented by HTTP replay. |
| Global scripts/README/CI redesign | N/A | Existing scripts discover active tests; scoped README supplies commands. Local config preserves shared accounts; clean CI retains owned-environment setup. |
| Healing/fixme | N/A | Generated tests passed on the first execution. No failures hidden through skip/fixme or relaxed assertions. Mutation runs are intentional failing probes. |
| Full suite, clean CI, build/deploy, live GoTrue/OAuth | N/A | Not measured by this test-only workflow; limits are explicit in summary and DoD. |

The generic checklist's “E2E happy path only” and “one assertion per test” text is applied to the explicit race task as focused browser integration with one coherent behavioral contract per scenario. Identity, event ownership and corresponding UI assertions must stay connected to the same interleaving. Existing lower-level cases retain exhaustive cleanup permutations. Intentional UUID/email/event constants express the scenario; random browser identities use the platform UUID generator with factory overrides rather than new server accounts. Generic Faker, commerce and API-error templates do not justify unrelated work.
