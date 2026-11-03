import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import hooks from 'eslint-plugin-react-hooks';
import a11y from 'eslint-plugin-jsx-a11y';
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/generated/**',
      '**/.next/**',
      '**/node_modules/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/next-env.d.ts',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['**/*.{ts,tsx}'], rules: { '@typescript-eslint/no-explicit-any': 'error' } },
  {
    files: ['**/*.tsx'],
    plugins: { 'react-hooks': hooks, 'jsx-a11y': a11y },
    rules: { ...hooks.configs.recommended.rules, ...a11y.configs.recommended.rules },
  },
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        AbortSignal: 'readonly',
        clearTimeout: 'readonly',
        setTimeout: 'readonly',
        URL: 'readonly',
        Buffer: 'readonly',
      },
    },
  },
  prettier,
);
