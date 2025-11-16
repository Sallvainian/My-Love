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
      // React Refresh rules
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // Relax some overly strict TypeScript rules
      '@typescript-eslint/no-explicit-any': 'off', // Too many instances to fix immediately
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
  // Special config for test files
  {
    files: ['tests/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'off', // Test fixtures may use hooks in non-standard ways
      '@typescript-eslint/ban-ts-comment': 'off', // Tests may need to use @ts-ignore for mocking
    },
  },
);
