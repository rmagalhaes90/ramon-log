import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/**', 'dist-v4/**', 'index.html', 'sw.js'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  prettier,
  {
    ...tseslint.configs.disableTypeChecked,
    files: ['scripts/**/*.mjs', 'functions/**/*.{js,mjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: [
      'app-v4/src/**/*.ts',
      'app-v4/tests/**/*.ts',
      'packages/domain/src/**/*.ts',
      'packages/domain/tests/**/*.ts',
      'mobile/**/*.{ts,tsx}',
      '*.config.ts',
    ],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
);
