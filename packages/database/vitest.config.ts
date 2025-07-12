import path from 'node:path'
import {
  defineWorkersConfig,
  readD1Migrations,
  WorkersUserConfigExport,
} from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig(async () => {
  // Read all migrations in the `migrations` directory
  const migrationsPath = path.join(__dirname, 'migrations')
  const migrations = await readD1Migrations(migrationsPath)

  const options: WorkersUserConfigExport = {
    test: {
      setupFiles: ['./test/apply-migrations.ts'],
      poolOptions: {
        workers: {
          wrangler: {
            // api worker is the primary worker for handling API requests
            configPath: 'wrangler.jsonc',
          },
          miniflare: {
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
