DW-84 Definition of Done — complete

- [x] Scope established from actual helper change `575009ea` and DW-84 acceptance criteria; ledger status not used as evidence.
- [x] Existing framework, manifests, auth, fixtures and knowledge loaded; original and predecessor coverage checked.
- [x] Prioritized selective plan: one P1 API persistence/partner-read test and one P1 Settings journey; no duplicate calendar matrix.
- [x] One shared fixture factory executes real exports in an isolated Nuuk child, uses a fixed regression date, unique identities, literal oracles and immutable anchor checks.
- [x] Single merged fixture entry reused; existing worker-pair setup and checked teardown own all generated event rows.
- [x] API uses typed/schema-validated responses and real auth; UI observes network before action and waits response → store → UI.
- [x] All generated tests have priority IDs and Given/When/Then structure, with no focus, skips, arbitrary waits, swallowed failures, speculative endpoints or fabricated selectors.
- [x] Two generated tests passed with two workers, zero retries and zero skips. Existing 21 unit cases passed.
- [x] Full typecheck passed after correcting the generated boolean polling predicate; full lint passed with three existing warnings.
- [x] All three staged files removed; generated-label event row count is zero; own CLI session and test dev server closed.
- [x] Protected input hashes unchanged; ledger preserved; no sprint-status file was written or reverted.
- [x] Run instructions, coverage plan, worker outputs, actual verification evidence, limitations and source manifest saved under TEA test_artifacts.

| Acceptance criterion | Evidence |
| --- | --- |
| Nuuk +1 and adjacent offsets match literal dates and unchanged factory, anchor preserved | 21-case unit run includes five Nuuk cases; shared fixture verifies the gap and immutability; API/E2E literal March 28 assertions passed. |
| Existing midnight/default/local/calendar behavior is preserved with unchanged runner | All 21 existing unit cases passed; helper, factory and runner input hashes unchanged. |
| Authorized scope and protected files are preserved | Only this new artifact bundle and required completion marker are added by this workflow. Implementation files, prior artifact copies and ledger remain unchanged from entry. |

Execution evidence is in `evidence/verification.json` and linked reports named by `automation-summary.md`. No percentage coverage or flake-rate claim is made. The historical implementation spec records its earlier red phase; that baseline mutation was not rerun in this session.

These are canonical artifact copies, not automatically discovered CI tests. Use `run.py` to stage and execute them through the normal projects; no root package/config changes are required. Running the staging wrapper concurrently with itself is unsupported and safely rejects file collisions. A future deliberate promotion can make them permanent normal-suite tests.

Not applicable: new component/unit matrices, HTTP rejection permutations, consumer-driven Pact contracts, production build/deploy, package script changes, archive edits, global timezone changes, and automatic review/trace invocation. Single-pass runtime and unchanged React/Vite/Fast Refresh warnings are documented as limits, not hidden by test suppression.
