import {
  defineWorkersConfig,
  WorkersUserConfigExport,
} from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig(async () => {
  const options: WorkersUserConfigExport = {
    test: {
      poolOptions: {
        workers: {
          wrangler: {
            // api worker is the primary worker for handling API requests
            configPath: 'wrangler.jsonc',
          },
        },
      },
    },
  }

  return options
})
