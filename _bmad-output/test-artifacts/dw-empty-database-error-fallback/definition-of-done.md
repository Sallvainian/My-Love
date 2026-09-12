# DW-39 Definition of Done

**Automation generation: complete. Authenticated E2E runtime verification: pending local Docker/Supabase.** This checklist describes the automation deliverables, not release approval.

## Scope and coverage

- [x] Load TEA configuration, DW-39 intent contract, current implementation, framework, and existing coverage.
- [x] Resolve Create / BMad-Integrated / frontend / agent-team execution.
- [x] Retain the existing 84-case direct unit matrix; avoid copying it into every layer.
- [x] Add five SDK/parser-to-converter API cases and one failed event-save browser journey.
- [x] Assign stable DW39 IDs and priorities: P0 0, P1 3, P2 3, P3 0.
- [x] Preserve mapped text, meaningful whitespace, context, diagnostics, and numeric compatibility assertions.
- [x] Keep omitted-property service classification outside DW-39, as the spec requires.

## Test construction

- [x] Use existing merged fixtures, authentication, interception, polling, and report logging.
- [x] Supply one fresh-object error-envelope factory with scenario overrides.
- [x] Document the SDK fetch injection: `apiRequest` would bypass the parser under test.
- [x] Register the browser POST intercept before navigation.
- [x] Await the response and newly displayed returned error before inspecting the unchanged store; retain form/input/retry assertions.
- [x] Use stable test IDs and a unique event label.
- [x] Avoid persisted test rows, shared account changes, fixed waits, focused/skipped tests, and UI-dependent branching.
- [x] Limit network-monitor opt-out to the browser case's deliberate HTTP 400.

## Verification and evidence

- [x] Discover six cases in two files using the canonical Playwright configuration.
- [x] Execute all five SDK tests successfully with two workers, zero retries.
- [x] Demonstrate regression sensitivity: old fallback fails DW39-API-001/002 while three compatibility cases still pass.
- [x] Restore production handler bytes exactly after the negative control.
- [x] Execute 184 affected unit tests in four files, including all 84 direct handler tests.
- [x] Pass `npm run typecheck` and `npm run lint`; generated-file lint is clean. Three existing EventCountdown warnings remain.
- [x] Save command logs, machine-readable counts, source checks, and checksummed source snapshots.
- [x] Confirm the incoming orchestrator ledger is unchanged and production code matches HEAD.
- [ ] Execute DW39-E2E-001 with authenticated local Supabase. Current preflight failed because the OrbStack Docker socket is absent.
- [ ] Measure browser stability/repetition if needed after the first successful authenticated run. No browser stability claim is made now.

## Delivery

- [x] Save tests/fixture snapshots, worker outputs, manifest, knowledge list, README, summary, and this checklist under `_bmad-output/test-artifacts`.
- [x] Keep canonical tests runnable through the existing test projects and provide an isolated SDK command.
- [x] Record live verification limits separately from generation completion.

Checklist interpretations follow the loaded knowledge: each test owns one behavior and may assert several related fields; fixed blank/null/numeric inputs define the contract and must not be randomized; the single negative E2E covers the changed error-presentation journey. API tests use Arrange/Act/Assert structure, and the browser report labels Given/When/Then steps. No additional user/product/order factories, cleanup helpers, Pact suite, or generic HTTP-status matrix are relevant.

Global `tests/README.md` and package scripts need no changes: their update flags are unset, existing discovery reaches the tests, and this package supplies execution instructions. No automatic healing or `test.fixme` is needed; unavailable infrastructure is not a failing browser assertion.

Next: start Docker and run the E2E command in [README.md](README.md). After live evidence is available, `bmad-testarch-trace` can record acceptance-criteria evidence and gate status.
