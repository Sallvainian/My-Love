/**
 * The honesty invariant, enforced repo-wide
 *
 * Two exported symbols close their message with a promise that the user's
 * change is queued and will sync later:
 *
 *   - `handleNetworkError`   (`src/api/errorHandlers.ts:95`)
 *     "... Your changes will be synced when you're back online."
 *   - `OFFLINE_ERROR_MESSAGE` (`src/utils/offlineErrorHandler.ts:74`)
 *     "You're offline. Changes will sync when reconnected."
 *
 * Both are TRUE for mood and daily/custom messages, which are offline-first
 * with IndexedDB primary and a service-worker sync queue. Both are FALSE for
 * every Supabase-only feature, where a write that never left the device is not
 * waiting to sync — it is gone.
 *
 * Two features have been repaired one at a time (`eventsService`, then
 * `interactionService`), each by hand-rolling a local error builder. What has
 * never existed is anything that fails when the *next* Supabase-only feature
 * imports one of these symbols: the property is held up today by two module
 * headers, four `// NOT handleNetworkError:` comments, and reviewer attention.
 * This file is that missing check.
 *
 * **This is a static scan, not module resolution.** It reads each file and
 * inspects its import statements after stripping comments. An ESLint
 * `no-restricted-imports` override scoped to the same file list would be
 * stronger — it resolves modules and runs in the job that already lints `src`
 * — and is the recommended upgrade. It is not done here because it edits
 * `eslint.config.js`, which is an operator decision rather than a test change.
 * See
 * `_bmad-output/test-artifacts/automation-summary-epic-dw-events-offline-message-honesty.md`.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, it, expect } from 'vitest';

// Vitest runs from the directory holding `vitest.config.ts`, which is the repo
// root. `import.meta.url` is not usable here: under the happy-dom environment
// it is rewritten to a non-`file:` URL and `fileURLToPath` throws.
const REPO_ROOT = process.cwd();

/** The symbols whose message promises a sync. */
const SYNC_PROMISING_SYMBOLS = ['handleNetworkError', 'OFFLINE_ERROR_MESSAGE'] as const;

/**
 * Modules with no offline queue, so a sync promise from any of them is false.
 *
 * Every entry was confirmed against the file itself rather than copied from a
 * list, because a wrong entry either blocks a legitimate import or silently
 * protects nothing:
 *
 *   - `interactionService.ts` — module header, lines 8-16: "interactions are
 *     Supabase-only — no offline queue, no IndexedDB mirror, no retry".
 *   - `eventsService.ts:32` — "No realtime, no IndexedDB mirror: events are
 *     Supabase-only".
 *   - `photoService.ts` — imports exactly `supabase` and `logger`. The
 *     IndexedDB `photos` store (`dbSchema.ts:268`) belongs to the separate
 *     legacy `storage.ts` layer, which this module never touches.
 *   - `notesSlice.ts` — contains no IndexedDB reference at all; writes go
 *     straight to Supabase.
 *   - `eventsSlice.ts:12` — "Supabase only. NOT persisted to localStorage and
 *     NOT mirrored to IndexedDB".
 *   - `interactionsSlice.ts:14` — "Interactions are ephemeral (not persisted
 *     to LocalStorage/IndexedDB)".
 *
 * Deliberately absent: `moodApi.ts`, `moodSyncService.ts` and `MoodTracker.tsx`,
 * where both symbols are correct. `moodApi.ts` is the trap — it imports no
 * persistence module of its own, so any rule that derives this list from
 * imports flags it, and mood is offline-first at the feature level through
 * `moodSyncService` and `moodService`.
 */
const SUPABASE_ONLY_MODULES = [
  'src/api/interactionService.ts',
  'src/services/eventsService.ts',
  'src/services/photoService.ts',
  'src/stores/slices/notesSlice.ts',
  'src/stores/slices/eventsSlice.ts',
  'src/stores/slices/interactionsSlice.ts',
];

/**
 * The legitimate importers, used as a positive control below. A guard that only
 * ever asserts absence passes just as happily when its detector is broken, so
 * these prove the detector sees a real import when one is there.
 */
const OFFLINE_FIRST_IMPORTERS: { file: string; symbol: string }[] = [
  { file: 'src/api/moodApi.ts', symbol: 'handleNetworkError' },
  { file: 'src/api/moodSyncService.ts', symbol: 'handleNetworkError' },
  { file: 'src/components/MoodTracker/MoodTracker.tsx', symbol: 'OFFLINE_ERROR_MESSAGE' },
];

/**
 * The local names a module brings in through `import { ... } from '...'`.
 *
 * Comments are stripped first, and that is load-bearing rather than tidiness:
 * `interactionService.ts` names `handleNetworkError` four times in prose
 * explaining why it does not use it, and a plain substring search would report
 * the very file this invariant was written for.
 */
function importedNames(source: string): Set<string> {
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  const names = new Set<string>();
  const namedImport = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"][^'"]+['"]/g;

  for (const match of code.matchAll(namedImport)) {
    for (const clause of match[1].split(',')) {
      const local = clause.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
      if (local) names.add(local);
    }
  }

  return names;
}

function readModule(relativePath: string): string {
  const absolute = resolve(REPO_ROOT, relativePath);
  // A path that has moved would make its case vacuously green, which is the
  // failure mode a hand-maintained list has.
  expect(existsSync(absolute), `${relativePath} does not exist — update this list`).toBe(true);
  return readFileSync(absolute, 'utf8');
}

describe('offline-message honesty', () => {
  describe('the detector', () => {
    // Nothing below this block means anything if these three fail.
    it('covers every module in the list', () => {
      expect(SUPABASE_ONLY_MODULES.length).toBeGreaterThan(0);
      expect(OFFLINE_FIRST_IMPORTERS.length).toBeGreaterThan(0);
    });

    it.each(OFFLINE_FIRST_IMPORTERS)(
      'still sees $symbol imported by $file, where the promise is true',
      ({ file, symbol }) => {
        expect(importedNames(readModule(file))).toContain(symbol);
      }
    );

    it('does not count a symbol that only appears in a comment', () => {
      const source = [
        '// NOT handleNetworkError: no offline queue exists here.',
        '/* OFFLINE_ERROR_MESSAGE promises a sync, so it is wrong for this module. */',
        "import { isOnline } from './errorHandlers';",
      ].join('\n');

      expect(importedNames(source)).toEqual(new Set(['isOnline']));
    });
  });

  describe('modules with no offline queue', () => {
    it.each(SUPABASE_ONLY_MODULES)(
      '%s imports neither symbol that promises a sync',
      (relativePath) => {
        const imported = importedNames(readModule(relativePath));

        // Named whole rather than looped over, so a failure prints which
        // symbol arrived and in which file.
        const promising = SYNC_PROMISING_SYMBOLS.filter((symbol) => imported.has(symbol));

        expect(promising).toEqual([]);
      }
    );
  });
});
