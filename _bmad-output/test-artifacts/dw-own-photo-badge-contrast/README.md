# DW-59 own-photo badge automation

Four Playwright browser component cases cover the actual PhotoGridItem and application stylesheet:
two P1 contrast regressions and two P2 appearance/interaction regressions, each in light and dark
media. API coverage is not applicable to the one-token CSS change; the API worker records why in
`workers/api.json`.

From the project root, with Node 24 dependencies installed and local Supabase running:

```bash
python3 _bmad-output/test-artifacts/dw-own-photo-badge-contrast/run.py
```

The runner refuses to overwrite existing files, temporarily copies this bundle's `tests/` subtree
into the project's `tests/`, runs the existing Chromium project, and removes its unchanged copies
in a finally block. Playwright starts the test-mode Vite server if needed. No decrypted production
credentials are needed. The shared Playwright global setup still requires local Supabase, although
these cases opt out of authentication and create no database rows or storage objects.

The files are retained here as runnable TEA artifacts; they are not included in default CI
discovery after the activation copies are removed. For permanent discovery, promote the generated
`tests/` subtree to the matching repository paths. No files belong in tests/e2e-archive.

Run the P1 subset or typecheck the activated files:

```bash
python3 _bmad-output/test-artifacts/dw-own-photo-badge-contrast/run.py npx playwright test tests/e2e/photos/own-photo-badge-contrast.spec.ts --project=chromium --workers=1 --grep '\[P1\]'
python3 _bmad-output/test-artifacts/dw-own-photo-badge-contrast/run.py npm run typecheck
```

The browser-local photo factory produces a valid white PNG and complete typed own/partner
PhotoWithUrls records. White pixels are intentional adverse input; fixture identities need no
database uniqueness because each page owns its records. The harness uses the production component,
and the spec imports the existing merged fixtures. Locator assertions and Playwright Utils recurse
synchronize image decoding, opacity transitions, fonts, and callback output; no sleeps are used.

See `definition-of-done.md` for commands, measured results, limitations, and acceptance mapping.
