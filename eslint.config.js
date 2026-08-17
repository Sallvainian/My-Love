import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Global ignores (migrated from .eslintignore)
  {
    ignores: [
      'dist/**',
      'dev-dist/**',
      'build/**',
      'coverage/**',
      'node_modules/**',
      '.bmad/**',
      'scripts/**', // Utility scripts, not production code
      '**/*.config.js',
      '**/*.config.ts',
      'vite.config.*',
      'playwright.config.*',
      'src/types/database.types.ts',
    ],
  },
  // Base configs
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // A disable directive is a written exemption, so a dead one is a false claim about the
  // code. ESLint reports these as warnings by default and `npm run lint` passes no
  // --max-warnings, which is how the stale suppressions cleaned up in 2226cc01 and
  // e9d41bad survived in the first place. Error makes CI reject them.
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // React Hooks rules
      ...reactHooks.configs.recommended.rules,

      // React 19 strict rules. Every site in the tree is either fixed or carries a
      // file-local disable directive with a written rationale, so these are errors: a new
      // violation is a mistake until someone justifies it in place. The legitimate patterns
      // (blob URL lifecycle, async fetch-on-mount, subscription bridges) stay opted out one
      // line at a time rather than blanket-downgraded for the whole codebase.
      // See: https://react.dev/learn/you-might-not-need-an-effect
      'react-hooks/set-state-in-effect': 'error',
      'react-hooks/purity': 'error',

      // React Refresh rules
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // Relax some overly strict TypeScript rules
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // Warn on console.log in production code (console.warn/error are allowed)
      'no-console': ['error', { allow: ['warn', 'error'] }],

      // Disable problematic rules
      'no-useless-catch': 'off',
    },
  },
  // React code guardrails for store access and submission controls
  {
    files: ['src/components/**/*.{ts,tsx}', 'src/hooks/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'useAppStore',
          property: 'getState',
          message:
            'Do not use useAppStore.getState() in React code. Use useAppStore with a useShallow selector.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "VariableDeclarator[id.name='getState'][init.object.name='useAppStore'][init.property.name='getState']",
          message:
            'Do not assign getState from useAppStore. Use useAppStore with a useShallow selector.',
        },
        {
          selector:
            "JSXOpeningElement[name.name='button']:has(JSXAttribute[name.name='data-testid'][value.value='scripture-message-send-btn']):not(:has(JSXAttribute[name.name='disabled']))",
          message: 'Submission controls must include a disabled prop.',
        },
        {
          selector:
            "JSXOpeningElement[name.name='button']:has(JSXAttribute[name.name='data-testid'][value.value='scripture-reflection-continue']):not(:has(JSXAttribute[name.name='disabled']))",
          message: 'Submission controls must include a disabled prop.',
        },
        {
          selector:
            "JSXOpeningElement[name.name='button']:has(JSXAttribute[name.name='data-testid'][value.value='scripture-reflection-summary-continue']):not(:has(JSXAttribute[name.name='disabled']))",
          message: 'Submission controls must include a disabled prop.',
        },
      ],
    },
  },
  // Special config for CommonJS files
  {
    files: ['**/*.cjs'],
    languageOptions: {
      globals: globals.node,
      sourceType: 'commonjs',
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  // Service worker files — no window context, can't use logger utility
  {
    files: ['src/sw.ts', 'src/sw-db.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  // Special config for test files (unit tests and E2E)
  {
    files: ['tests/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', 'e2e/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'off', // Test fixtures may use hooks in non-standard ways
      'no-empty-pattern': 'off', // Playwright fixtures use empty destructuring for deps
      '@typescript-eslint/ban-ts-comment': 'off', // Tests may need to use @ts-ignore for mocking
      '@typescript-eslint/no-unused-vars': 'off', // Tests often have unused imports/mocks/fixtures
      'no-global-assign': 'off', // Tests may mock global objects like Date
      '@typescript-eslint/no-unused-expressions': 'off', // Tests may have expressions for side effects
      'no-restricted-syntax': 'off', // Tests may inspect store state directly
      'no-restricted-properties': 'off', // Tests may inspect store state directly
      'no-console': 'off', // Test output and diagnostics use console.log intentionally
    },
  },
  // src/ standardizes on the explicit zod/v4 path. Bare 'zod' resolves to the
  // same v4 classic surface under zod 4, so this is consistency, not correctness.
  // tests/ is exempt: three tests/api specs import bare 'zod'.
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'zod',
              message: "Import from 'zod/v4' instead of bare 'zod'.",
            },
          ],
        },
      ],
    },
  },
  // Scripture containers must not import Supabase clients directly
  {
    files: ['src/components/scripture-reading/containers/**/*.{ts,tsx}'],
    rules: {
      // Flat config replaces a rule key rather than merging it, so the zod entry
      // from the src/ block above is repeated here to survive this override.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@supabase/supabase-js',
              message:
                'Container components must use Zustand slice actions instead of direct Supabase imports.',
            },
            {
              name: 'zod',
              message: "Import from 'zod/v4' instead of bare 'zod'.",
            },
          ],
          patterns: [
            {
              group: [
                '**/api/supabaseClient',
                '@/api/supabaseClient',
                '**/services/*',
                '@/services/*',
                '!**/services/scriptureReadingService',
                '!@/services/scriptureReadingService',
              ],
              message:
                'Container components must use Zustand slice actions instead of importing Supabase or service modules directly.',
            },
          ],
        },
      ],
    },
  },
  // Scripture Reading feature - strict no-explicit-any enforcement
  {
    files: [
      'src/services/scriptureReadingService.ts',
      'src/stores/slices/scriptureReadingSlice.ts',
      'src/hooks/useScriptureBroadcast.ts',
      'src/components/scripture-reading/**/*.{ts,tsx}',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  }
);
