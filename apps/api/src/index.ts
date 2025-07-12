import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { bearerAuth } from 'hono/bearer-auth'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { z } from 'zod'

import { CrateRepository } from '@riddick/database'
import type { QueueMessage } from '@riddick/types'
import { CrateStatus } from '@riddick/types'

type Bindings = {
  API_KEY: string
  CRATE_QUEUE: Queue
  DB: D1Database
  CRATES_STORAGE: R2Bucket
  CRATES_API_BASE_URL: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/index', prettyJSON(), logger(), async (c, next) => {
  const auth = bearerAuth({ token: c.env.API_KEY })
  return auth(c, next)
})
app.use('/index/*', prettyJSON(), logger(), async (c, next) => {
  const auth = bearerAuth({ token: c.env.API_KEY })
  return auth(c, next)
})

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
})

// Index endpoint - queue crate processing
app.post(
  '/index',
  zValidator(
    'json',
    z.object({
      crate_name: z.string(),
      version: z.string(),
    }),
  ),
  async (c) => {
    const { crate_name, version } = c.req.valid('json')

    try {
      const crateRepo = new CrateRepository(c.env.DB)

      // Check if crate already exists
      const existingCrate = await crateRepo.getCrateByNameVersion(
        crate_name,
        version,
      )

      if (existingCrate) {
        return c.json({
          success: true,
          message: 'Crate already exists',
          crate_id: existingCrate.id,
          status: existingCrate.status,
        })
      }

      // Create new crate record
      const newCrate = await crateRepo.createCrate({
        name: crate_name,
        version,
        status: CrateStatus.QUEUED,
      })

      // Queue the processing task
      const queueMessage: QueueMessage = {
        crate_id: newCrate.id,
        crate_name,
        version,
        stage: 'fetch',
        created_at: new Date().toISOString(),
      }

      await c.env.CRATE_QUEUE.send(queueMessage)

      return c.json({
        success: true,
        message: 'Crate queued for processing',
        crate_id: newCrate.id,
        status: newCrate.status,
      })
    } catch (error) {
      console.error('Error queuing crate:', error)
      return c.json(
        {
          success: false,
          error: 'Failed to queue crate processing',
          details: String(error),
        },
        { status: 500 },
      )
    }
  },
)

// Get crate status
app.get(
  '/crate/:id',
  zValidator(
    'param',
    z.object({
      id: z.coerce.number(),
    }),
  ),
  async (c) => {
    const { id } = c.req.valid('param')

    try {
      const crateRepo = new CrateRepository(c.env.DB)
      const crate = await crateRepo.getCrate(id)

      if (!crate) {
        return c.json(
          {
            success: false,
            error: 'Crate not found',
          },
          { status: 404 },
        )
      }

      return c.json({
        success: true,
        crate,
      })
    } catch (error) {
      console.error('Error fetching crate:', error)
      return c.json(
        {
          success: false,
          error: 'Failed to fetch crate',
          details: String(error),
        },
        { status: 500 },
      )
    }
  },
)

export default app
