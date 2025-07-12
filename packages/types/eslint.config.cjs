const config = require('@riddick/eslint-config')

module.exports = [
  ...config,
  {
    ignores: ['src/rust_parser_generated/**'],
  },
]
