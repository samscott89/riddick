import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    projects: [
      'apps/*/vitest.unit.config.ts',
      'apps/*/vitest.config.ts',
      'packages/*/vitest.config.ts',
    ],
  },
})
