import path from 'node:path'
import type { WorkersUserConfigExport } from '@cloudflare/vitest-pool-workers/config'
import {
  defineWorkersConfig,
  readD1Migrations,
} from '@cloudflare/vitest-pool-workers/config'
import { getFixtureData, type FixtureData } from '@riddick/fixtures'

declare module 'vitest' {
  export interface ProvidedContext {
    fixtureData: FixtureData
  }
}

export default defineWorkersConfig(async () => {
  const migrationsPath = path.join(
    __dirname,
    '../../packages/database/migrations',
  )
  const migrations = await readD1Migrations(migrationsPath)

  const options: WorkersUserConfigExport = {
    test: {
      provide: {
        // Provide fixtures to all tests
        // we do this here because it uses `node` in the
        // fixtures package, which cannot be used in tests
        fixtureData: await getFixtureData(),
      },
      setupFiles: ['@riddick/database/test/apply-migrations.ts'],
      poolOptions: {
        workers: {
          wrangler: {
            configPath: 'wrangler.jsonc',
          },
          singleWorker: true,
          isolatedStorage: false,
          miniflare: {
            // Required to use `SELF.queue()`. This is an experimental
            // compatibility flag, and cannot be enabled in production.
            compatibilityFlags: ['service_binding_extra_handlers'],
            // Use a shorter `max_batch_timeout` in tests
            queueConsumers: {
              queue: { maxBatchTimeout: 0.5 /* 500ms */ },
            },
            serviceBindings: {
              // mock the RUST_PARSER service binding
              RUST_PARSER: () => ({}) as any,
            },
            bindings: {
              // Add a test-only binding for migrations, so we can apply them in a setup file
              TEST_MIGRATIONS: migrations,
            },
          },
        },
      },
    },
  }

  return options
})
