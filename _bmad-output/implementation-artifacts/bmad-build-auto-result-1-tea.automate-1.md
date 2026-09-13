---
status: done
---

TEA automate run for story 1 (F1, contain the exposed bot credential) completed.

- Summary: `_bmad-output/test-artifacts/automation-summary-1-contain-the-exposed-bot-credential.md`
- Definition of Done and evidence: `_bmad-output/test-artifacts/automation-1-contain-the-exposed-bot-credential/`
- New tests: `tests/integration/claude-bot-config-forward-migration.spec.ts` (2, P1), `tests/api/claude-bot-config-exposure.spec.ts` (4, P1), two cases added to `tests/unit/scripts/provision-claude-bot.test.ts` (P2)
- New helper: `tests/support/helpers/migration-replay.ts`
- Verification: 6/6 Playwright, 30/30 burn-in, 106 files / 1923 Vitest tests, lint 0 errors, typecheck clean; seven mutations, each caught by the intended test
