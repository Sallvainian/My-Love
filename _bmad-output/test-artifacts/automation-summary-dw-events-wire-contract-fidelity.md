---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-identify-targets', 'step-03-generate-tests', 'step-03a-subagent-api', 'step-03b-subagent-e2e', 'step-03c-aggregate', 'step-04-validate-and-summarize']
lastStep: 'step-04-validate-and-summarize'
lastSaved: '2026-09-12'
workflowType: 'testarch-automate'
runKey: 'dw-events-wire-contract-fidelity'
workflowStatus: 'completed'
detectedStack: 'frontend'
executionMode: 'subagent'
inputDocuments:
  - '_bmad/tea/config.yaml'
  - '_bmad-output/implementation-artifacts/spec-dw-70-72-events-wire-contract-fidelity.md'
  - '_bmad-output/test-artifacts/test-design-epic-5.md'
  - '_bmad-output/test-artifacts/atdd-checklist-5-manage-events-in-settings.md'
  - 'playwright.config.ts'
  - 'package.json'
  - 'tests/support/merged-fixtures.ts'
  - 'tests/api/events-wire-contract.spec.ts'
  - 'tests/support/helpers/events.ts'
  - 'tests/e2e/settings/events-persistence.spec.ts'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/api-request.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/auth-session.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/burn-in.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/ci-burn-in.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/confidence-gate.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/data-factories.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/file-utils.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/fixture-architecture.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/fixtures-composition.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/intercept-network-call.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/library-integration-mandate.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/log.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/network-error-monitor.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/network-first.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/network-recorder.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/overview.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/pact-mcp.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/playwright-cli.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/playwright-utils-mandate.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/recurse.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/selective-testing.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/test-levels-framework.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/test-priorities-matrix.md'
  - '.agents/skills/bmad-testarch-automate/resources/knowledge/test-quality.md'
totalTests: 6
newTests: 1
reusedTests: 5
priorityCoverage: {P0: 1, P1: 4, P2: 1, P3: 0}
---

# TEA automation — DW-70/72 Events wire-contract fidelity

Completed on 2026-09-12 for Sallvain. Created a validated artifact pack in the configured `_bmad-output/test-artifacts/dw-events-wire-contract-fidelity/` directory: five reused API cases, one new P2 browser case, and one pure data factory. Create mode used BMad-integrated context and parallel API/E2E subagents. The task-specific summary preserves an unrelated completed `automation-summary.md`.

## Coverage and files

- `tests/api/events-wire-contract-fidelity.spec.ts`: exact snapshot of the active `events-wire-contract.spec.ts`; one P0 and four P1 tests retain their DE.5-API IDs. Anonymous GET/POST denial is checked with abandoned rows, a same-label partner witness, and a matching creator positive control. Strict row/array schemas accept a real response and reject an extra key. Existing ordering, constraint and outsider-cleanup cases remain included.
- `tests/e2e/settings/events-wire-fidelity.spec.ts`: new P2 `DW.WIRE-E2E-001` verifies that two events with the same visible label retain separate UUIDs and owner controls through Settings reload. It checks real HTTP, then Zustand, then UI. This is supplementary compatibility evidence; both acceptance fixes are test-local API behavior.
- `tests/support/factories/events-wire-fidelity.ts`: pure typed factory taking a fresh UUID and one clock anchor. Two single-row seed calls avoid the shared batch seeder's duplicate-label guard. Null/calendar are materialized by the seeder; database defaults remain the API case's responsibility.
- `run.py`, `source-manifest.json`, `coverage-plan.md`, `definition-of-done.md`, `README.md`, worker JSON, knowledge/context records, and `evidence/` make the pack reproducible and traceable.

The source baseline is `07335c0da9f77ab2f70e1a00223630288592aadb`; the implementation is committed at `bb04e444`, with documentation at HEAD `79d32186`. The starting uncommitted ledger change belongs to the orchestrator and remains byte-for-byte unchanged. No local sprint-status.yaml was present; none was created or modified. Production source, active tests, generated files, runner configuration and archived tests were unchanged.

Historical test-design/ATDD artifacts were read. ATDD API IDs 001..003 remain separate. Generic reload and partner-read-only scenarios already exist; the new browser case specifically covers identity when labels collide. No additional unit/component/database or Pact tests are needed for this test-only change.

## Measured validation

| Check | Result |
| --- | --- |
| Discovery | Six tests across API and Chromium projects |
| First staged run, two workers | 6/6 passed; 7.282s reporter duration |
| Five repetitions each of API 004 and 007 | 10/10 passed; 10.307s |
| Final unmutated staged run, two workers | 6/6 passed; 6.850s |
| Typecheck with generated files staged | Exit 0 |
| Lint with generated files staged | Exit 0; three pre-existing EventCountdown Fast Refresh warnings |
| Loose-schema mutation | Failed at extra-column acceptance: true instead of false |
| Missing-owner mutation | Failed at current-attempt query: one row instead of zero |
| Fixed-label mutation | Failed at current-attempt query: one row instead of zero |
| Hygiene and cleanup | Hashes match; three staged files removed; no retained event rows for the ten worker pairs used |

All unmutated runs had zero skips, unexpected failures, flakes or retries. Each deliberate mutation failed in its intended case and assertion, not during setup. Only staged copies were mutated; source and artifact hashes remained intact. Detailed reports and commands are in `evidence/verification.json` and adjacent files. React development warnings and occasional auth shutdown diagnostics appeared in dev-server output; this run does not claim to resolve those diagnostics.

The CLI browser preflight loaded the expected unauthenticated Settings sign-in screen, then closed its named session. Authenticated selectors were grounded in source and exercised by the generated browser test. The Vite process started by this session was stopped; pre-existing Supabase containers remain running. Timestamped worker outputs were removed from `/tmp` after their durable copies were verified.

## Playwright Utils deviations

Both spec files import the existing merged fixtures (2/2). HTTP tests use `apiRequest`; the new browser test uses `interceptNetworkCall` and `recurse`, with network monitoring active. No new utility bypasses were introduced.

- `tests/api/events-wire-contract-fidelity.spec.ts:322,474,573,588,690`: inherited explicit-identity `getUserAccessToken` calls select creator/outsider roles alongside anonymous requests. Documented here and in `workers/api.json` instead of adding comments that would change the snapshot bytes.
- Checked privileged setup/cleanup retains the existing Supabase admin helpers. Error envelopes use direct status/code/message assertions; successful response schemas remain on real API paths.
- Native `randomUUID` follows the active suite's identity convention. Named static boundary/date values are intentional; the new factory accepts explicit identity/anchor inputs rather than a generic override bag.

The existing auth provider is reused. No HAR, webhook, download or new authentication wiring was needed. Focused `--repeat-each=5` provides bounded repetition evidence; no new burn-in selection infrastructure was added to this artifact-only scope.

Pact broker: unreachable (SmartBear MCP tools not available). Provider states derived from provider source. No provider states or Pact artifacts were actually needed: the relevance gate is closed for this frontend plus Supabase SQL layout. No broker calls were made.

## Run and limits

```sh
python3 _bmad-output/test-artifacts/dw-events-wire-contract-fidelity/run.py
```

Local Supabase must be running. The runner temporarily stages the artifact files in the existing projects, checks the active API hash, refuses overwrites, and removes unchanged copies afterward. README documents priority selection, repeat and mutation commands.

The new browser case is not installed into ordinary CI; the API cases already run from their original active source. This run verifies Chromium/local Supabase with two workers, not other browsers, sustained load, or repeated browser stability. No production build or broad coverage-percentage claim is made. The Definition of Done is satisfied for the requested artifact workflow. A later `test-review` or `trace` workflow can consume this pack if requested.
