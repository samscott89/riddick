import { defineConfig } from 'vitest/config'

// TODO: not currently used, but a nice pattern to keep around.
// run unit tests without the need for a worker pool
export default defineConfig({
  test: {
    name: 'crate-workflow-unit',
    environment: 'node',
    include: ['**/*.unit.test.ts'],
    globals: true,
  },
})
