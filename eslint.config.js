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

      // React 19 strict rules - downgraded to warn for legitimate patterns
      // These patterns are valid: blob URL lifecycle, timer setup, animation randomization
      // See: https://react.dev/learn/you-might-not-need-an-effect (these are recommendations, not errors)
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',

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
    },
  },
  // Scripture containers must not import Supabase clients directly
  {
    files: ['src/components/scripture-reading/containers/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@supabase/supabase-js',
              message:
                'Container components must use Zustand slice actions instead of direct Supabase imports.',
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
