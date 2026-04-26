import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: ['dist/', 'node_modules/', 'node_modules_from_root/', 'playwright-report/', 'target/', 'cpp-build/', 'bin/', 'archive/', 'backups/', 'test-results/', 'results/', 'webapp-analysis-results/', 'code-centric-reports/', 'native/', 'server/uploads/', 'server/projects/']
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': 'off'
    }
  },
  {
    files: ['server/**/*.js', 'server/**/*.cjs', '**/*.cjs', '**/*.js', 'tests/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off',
      '@typescript-eslint/no-require-imports': 'off'
    }
  }
];