import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { bearerAuth } from 'hono/bearer-auth'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { z } from 'zod'

import { handleParseRequest, EXAMPLE_REQUESTS } from '../../src/parser-endpoint'
import { CrateRepository } from '../../src/repositories/crate-repository'
import { CrateStatus } from '../../src/types'
import type { QueueMessage } from '../../shared/types'

type Bindings = {
  API_KEY: string
  CRATE_QUEUE: Queue
  DB: D1Database
  CRATES_STORAGE: R2Bucket
  CRATES_API_BASE_URL: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/parse', prettyJSON(), logger(), async (c, next) => {
  const auth = bearerAuth({ token: c.env.API_KEY })
  return auth(c, next)
})
app.use('/parse/*', prettyJSON(), logger(), async (c, next) => {
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
app.post('/index', 
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
      const existingCrate = await crateRepo.getCrateByNameVersion(crate_name, version)
      
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
      return c.json({
        success: false,
        error: 'Failed to queue crate processing',
        details: String(error),
      }, { status: 500 })
    }
  }
)

// Get crate status
app.get('/crate/:id', 
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
        return c.json({
          success: false,
          error: 'Crate not found',
        }, { status: 404 })
      }
      
      return c.json({
        success: true,
        crate,
      })
    } catch (error) {
      console.error('Error fetching crate:', error)
      return c.json({
        success: false,
        error: 'Failed to fetch crate',
        details: String(error),
      }, { status: 500 })
    }
  }
)

// Existing parse endpoints for testing
app.post('/parse', async (c) => {
  try {
    const parseRequest: { code: string } = await c.req.json()
    const result = await handleParseRequest(parseRequest)
    // Convert bigint to number for JSON serialization
    return c.json({
      ...result,
      parseTime: Number(result.parseTime),
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        parseTime: 0,
        crateInfo: null,
        errors: [{
          message: String(error),
          severity: 'error',
          location: null,
        }],
      },
      {
        status: 400,
      },
    )
  }
})

app.get('/parse/examples', (c) => {
  return c.json({
    success: true,
    examples: EXAMPLE_REQUESTS,
  })
})

app.get(
  '/parse/test/:id',
  zValidator(
    'param',
    z.object({
      id: z.coerce.number(),
    }),
  ),
  async (c) => {
    const { id } = c.req.valid('param')
    const example = EXAMPLE_REQUESTS[id]
    if (!example) {
      return c.json(
        {
          success: false,
          error: 'Example not found',
        },
        {
          status: 404,
        },
      )
    }

    try {
      const result = await handleParseRequest(example)

      return c.json({
        request: example,
        result: {
          ...result,
          parseTime: Number(result.parseTime),
        },
      })
    } catch (error) {
      return c.json(
        {
          request: example,
          result: {
            success: false,
            parseTime: 0,
            crateInfo: null,
            errors: [{
              message: String(error),
              severity: 'error',
              location: null,
            }],
          },
        },
        {
          status: 500,
        },
      )
    }
  },
)

export default app