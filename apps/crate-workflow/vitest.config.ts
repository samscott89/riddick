import type { WorkersUserConfigExport } from '@cloudflare/vitest-pool-workers/config'
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig(async () => {
  const options: WorkersUserConfigExport = {
    test: {
      poolOptions: {
        workers: {
          wrangler: {
            configPath: 'wrangler.jsonc',
          },
        },
      },
    },
  }

  return options
})
