---
title: 'Every Edge Function deploys from deploy.yml'
type: 'chore'
ticket: '3'
created: '2026-10-31'
status: 'built'
baseline_revision: 'fd2df715c4c4b87340f247aef5b2ff26ff77fd09'
route: 'oneshot'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** No workflow deploys Edge Functions. `upload-love-note-image` was deployed by hand from a laptop, and story 1's `send-push` has never reached the hosted project, so story 13 has nothing to check there.

**Approach:** `deploy.yml` gains a `functions` job that needs `migrate` and runs `supabase functions deploy` with no names, which deploys every function in `supabase/functions`. `build` needs `functions` instead of `migrate`, so a failed function deploy stops the site deploy. `supabase/config.toml` gains `[functions.upload-love-note-image]` with `verify_jwt = true`, the value the hosted project reports, beside story 1's `[functions.send-push]` (`verify_jwt = false`). A person triggers the first run, because it deploys to production.

</frozen-after-approval>

## Implementation Notes

Oneshot: about 30 changed lines across `deploy.yml`, `config.toml` and one AGENTS.md clause, all mechanical.

Hosted settings, read 2026-10-31, read-only, with `GET /v1/projects/{ref}/functions` and the fnox `SUPABASE_PAT`: there is one function, `upload-love-note-image`, at version 6, `ACTIVE`, with `verify_jwt: true`, no import map, and the entrypoint deployed from a laptop path. `send-push` is not deployed. The deploy keeps those settings: `verify_jwt` comes from `config.toml`, and no import map exists in the repo. `send-push` first appears at version 1 with `verify_jwt: false`, so for it "unchanged" means it matches `config.toml`. With no `push_sender_settings` row, `send-push` answers 401 (`handler.ts`), so deploying it before story 13 configures the hosted trigger is harmless. Configuring that trigger is story 13's job ("sets whatever the hosted trigger needs"), even though story 1's plan says "hosted gets them in story 3".

Job shape: it copies `migrate`'s setup-cli pin (2.118.0) and `environment: production`, and runs `supabase functions deploy --project-ref ${{ vars.SUPABASE_PROJECT_ID }} --use-api` with `SUPABASE_ACCESS_TOKEN` (a repo secret, so the job needs no link and no DB password). `--use-api` bundles on the server and needs no Docker image. There is no `--prune`, so a function that exists only on the hosted project is left alone. The production environment has no branch policy, so a `workflow_dispatch` from this branch can run before the merge. `supabase/functions/**` is not in `paths-ignore`, so a change to a function triggers a deploy.

Tasks:
- `.github/workflows/deploy.yml` -- add the `functions` job between `migrate` and `build`; set `build: needs: functions`; keep the comment style.
- `supabase/config.toml` -- add `[functions.upload-love-note-image]` (`enabled = true`, `verify_jwt = true`); update the comment above `[functions.send-push]` that says the section "arrives with story 3.3".
- `AGENTS.md` (separate docs commit) -- in the deploy paragraph under Maintained by hand, say that `deploy.yml` deploys every Edge Function after migrations and before the build, never by hand.

Built 2026-10-31. Files: `.github/workflows/deploy.yml` (new `functions` job; `build` now needs `functions`), `supabase/config.toml` (new `[functions.upload-love-note-image]`; the "arrives with story 3.3" comment is gone), and `AGENTS.md` (the deploy paragraph under Maintained by hand).

Checks run:
- `actionlint .github/workflows/deploy.yml` printed 3 shellcheck notes, all in the health-check script that was already there; the baseline file prints the same 3, so the change adds none.
- Parsing the `needs:` chain gives `migrate → functions → build → deploy → health-check`.
- `npx supabase@2.118.0 functions deploy --help` lists `--project-ref`, `--use-api` and "Deploys all if omitted".
- `tomllib` reads both `[functions]` sections.
- `supabase functions serve` on the local stack served `send-push` and `upload-love-note-image`. A POST with no auth got `401 UNAUTHORIZED_NO_AUTH_HEADER` from the gateway for `upload-love-note-image` (`verify_jwt = true`) and the handler's own `401 {"error":"Unauthorized"}` for `send-push` (`verify_jwt = false`). The serve process was stopped afterwards.

Not run: the production `workflow_dispatch` and the second Management API read. A person runs those (hitl).

## Review Triage Log

Quick pass 1, 2026-10-31. One medium patched, two low patched, one medium deferred, three false.
- `false` (verify not met): the dispatch and the second Management API read are the hitl half, which the ticket gives to a person. They are recorded under Hand checks, not a defect in the diff.
- `medium` `patch` (the hand check redeploys the site and a live update from the branch): true, `workflow_dispatch` runs `build`, `deploy` and `Package live update`. The hand check now says this, and says to dispatch only while the branch is `main` plus this change.
- `medium` `defer` (every push rebuilds the functions from the unpinned esm.sh import): the import is older than this change, and the every-run deploy is what the ticket asks for. Pinning the import and gating the job on paths are both choices outside this ticket. Recorded as DW-355, with the version drift unverified.
- `low` `patch` (the deploy job's comment says only it can read production-environment secrets): `migrate` and now `functions` both declare `environment: production`. The comment now names the two Supabase jobs. `SUPABASE_PROJECT_ID` is a repo variable (`gh api .../actions/variables`), so the environment is kept for the production deployment record and to match `migrate`, not for a secret.
- `false` (story 1's plan says hosted settings come in story 3): story 13's ticket owns the hosted trigger set-up, and this plan records that. Story 1's plan is done and is not this story's to edit.
- `low` `patch` (the config.toml comment is in the past tense about a deploy that has not happened yet): reworded to cite the hosted read of the hand-made deploy.
- `false` (the docs commit split is not done yet): the commit comes after review, and AGENTS.md is committed on its own.

## Verification

**Commands:**
- `npx --yes action-validator .github/workflows/deploy.yml` or `actionlint` if installed -- expected: no errors.
- `supabase functions deploy --help` on 2.118-era flags (`--project-ref`, `--use-api`; no names means all) -- confirmed on 2.122.
- `supabase start` and then `supabase functions serve` locally -- expected: both functions load with the new config.toml (verify_jwt per section).
- `yq`/`python -c yaml` parse of the `needs:` chain -- expected: `functions.needs == migrate`, `build.needs == functions`.

**Hand checks (person):**
- The dispatch runs the whole workflow. It also builds and deploys the site from the branch and publishes a live update, so every shell downloads a bundle. Dispatch only while the branch is `main` plus this change alone (rebase first if `main` has moved), or the run rolls the site and the shells back. Run `gh workflow run deploy.yml --ref ci/deploy-edge-functions`, then read `GET /v1/projects/{ref}/functions` again. Expected: `upload-love-note-image` above version 6 with `verify_jwt: true`, `send-push` present with `verify_jwt: false`, and the run's functions job finishing before build starts.
