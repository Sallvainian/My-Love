import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    // Mirrors vite.config.ts, which this config does not extend.
    __APP_VERSION__: JSON.stringify(pkg.version),
    // Not the app's project: `.invalid` is reserved (RFC 2606) and never
    // resolves, so a unit test that escapes its fetch stub fails instead of
    // calling a real Supabase project.
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://unit-tests.invalid'),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY': JSON.stringify(
      'test-anon-key-for-unit-tests'
    ),
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    // Puts every `vi.spyOn` back before each test, so a spy a file forgets to
    // restore cannot leak into the next test.
    restoreMocks: true,
    setupFiles: ['./tests/setup.ts'],
    // Pinned to a NEGATIVE-offset zone, and load-bearing rather than cosmetic.
    //
    // `eventsService.parseEventDate` exists to stop `new Date('2026-09-12')`,
    // the ECMA-262 date-only form, which is parsed as UTC midnight and renders
    // the previous day everywhere west of UTC. Under TZ=UTC the correct and the
    // broken implementation are indistinguishable — measured: both yield
    // getDate()===12 and getHours()===0 — so on a UTC runner (GitHub's
    // ubuntu-latest) that regression ships green. Under a negative offset the
    // broken form yields getDate()===11, and the assertions fail as they should.
    //
    // The whole suite passes under this zone; nothing else depends on UTC.
    env: {
      TZ: 'America/New_York',
    },
    // The seed a `--sequence.shuffle` run orders files and tests by, from SEED
    // (CI passes its run number) or 1, so a shuffled failure replays exactly.
    // Read here rather than as `${SEED:-1}` in the npm script, which cmd.exe
    // would pass through unexpanded.
    sequence: {
      seed: Number(process.env.SEED) || 1,
    },
    reporters: ['default', 'junit'],
    outputFile: {
      junit: 'test-results/vitest-junit.xml',
    },
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        // Test harnesses beside the suites (fakePhotoStore, eventsSettingsKit, ...).
        'src/**/__tests__/**',
      ],
      thresholds: {
        lines: 25,
        functions: 25,
        branches: 25,
        statements: 25,
      },
    },
  },
});
