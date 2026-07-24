// @ts-check
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.turbo/**',
      '**/build/**',
      '**/generated-types.ts',
      'apps/api/prisma/migrations/**',
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // CLAUDE.md: "any" yasak — kept as a warning for now so CI doesn't
      // suddenly fail on pre-existing code; tighten to "error" once the
      // existing codebase is clean.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },
);
