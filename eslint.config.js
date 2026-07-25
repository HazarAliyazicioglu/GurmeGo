// @ts-check
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
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
  {
    // This config file itself is plain CommonJS (Node loads it via `require()`, not ESM), so it
    // necessarily uses `require()` to load `typescript-eslint` above. Without this override — placed
    // LAST so it wins over `tseslint.configs.recommended` above for this specific file — the
    // recommended rules would apply to this very file and flag that `require()` call as a
    // `@typescript-eslint/no-require-imports` error, making `eslint .` from the repo root fail
    // against its own config — caught by the round-3 final review.
    files: ['eslint.config.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
