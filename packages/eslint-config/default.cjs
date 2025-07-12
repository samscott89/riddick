const { resolve } = require('node:path')
const js = require('@eslint/js')
const tseslint = require('typescript-eslint')
const importPlugin = require('eslint-plugin-import')
const prettierConfig = require('eslint-config-prettier')

const project = resolve(process.cwd(), 'tsconfig.json')

/** @type {import("eslint").Linter.Config[]} */
module.exports = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    files: ['**/*.{ts,tsx,mjs}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2024,
        sourceType: 'module',
        project: true,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      import: importPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: {
          project,
        },
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports' },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/array-type': ['warn', { default: 'array-simple' }],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      'prefer-const': 'warn',
      'no-mixed-spaces-and-tabs': ['error', 'smart-tabs'],
      'no-empty': 'warn',
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        module: true,
        require: true,
        process: true,
        __dirname: true,
        __filename: true,
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]
