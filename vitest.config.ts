import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://xojempkrugifnaveqtqc.supabase.co'),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY': JSON.stringify(
      'test-anon-key-for-unit-tests'
    ),
  },
  test: {
    globals: true,
    environment: 'happy-dom',
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
