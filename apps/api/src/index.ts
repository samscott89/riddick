import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { bearerAuth } from 'hono/bearer-auth'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { z } from 'zod'

import { CrateRepository } from '@riddick/database'
import type {
  FileInfo,
  FunctionDetails,
  ItemInfo,
  QueueMessage,
} from '@riddick/types'
import { CrateStatus } from '@riddick/types'

type Bindings = {
  API_KEY: string
  CRATE_QUEUE: Queue
  DB: D1Database
  CRATES_STORAGE: R2Bucket
  CRATES_API_BASE_URL: string
  AUTORAG: any
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

const indexSchema = z.object({
  crate_name: z.string(),
  version: z.string(),
})

// Index endpoint - queue crate processing
app.post('/index', zValidator('json', indexSchema), async (c) => {
  const { crate_name, version } = c.req.valid('json')

  try {
    const crateRepo = new CrateRepository(c.env.DB)

    // Check if crate already exists
    const existingCrate = await crateRepo.getCrateByNameVersion(
      crate_name,
      version,
    )

    if (existingCrate) {
      if (existingCrate.status === CrateStatus.FAILED) {
        // delete the failed crate and try again
        await crateRepo.deleteCrate(existingCrate.id)
      } else {
        // If crate already exists and is not failed, return existing crate info
        return c.json({
          success: true,
          message: 'Crate already exists',
          crate_id: existingCrate.id,
          status: existingCrate.status,
        })
      }
    }

    // Create new crate record
    const newCrate = await crateRepo.createCrate({
      name: crate_name,
      version,
      status: CrateStatus.PENDING,
    })

    // Queue the processing task
    const queueMessage: QueueMessage = {
      crateId: newCrate.id,
      crateName: crate_name,
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
})

// Apply bearerAuth middleware to the new crates endpoints
app.use('/crates/*', prettyJSON(), logger(), async (c, next) => {
  const auth = bearerAuth({ token: c.env.API_KEY })
  return auth(c, next)
})

// Get crate status
app.get(
  '/crates/:name/:version/status',
  zValidator(
    'param',
    z.object({
      name: z.string(),
      version: z.string(),
    }),
  ),
  async (c) => {
    const { name, version } = c.req.valid('param')

    try {
      const crateRepo = new CrateRepository(c.env.DB)
      const crate = await crateRepo.getCrateByNameVersion(name, version)

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

// Get crate summary
app.get('/crates/:name/:version/summary', async (c) => {
  const { name, version } = c.req.param()

  try {
    const crate = await c.env.CRATES_STORAGE.get(
      `crates/${name}/${version}/crate.json`,
    )
    if (!crate) {
      return c.json(
        {
          success: false,
          error: 'Crate not found',
        },
        { status: 404 },
      )
    }

    const crateData: FileInfo = await crate.json()
    if (!crateData.agent_summary) {
      return c.json(
        {
          success: false,
          error: 'No summary available for this crate',
        },
        { status: 404 },
      )
    }
    return c.json({
      success: true,
      summary: crateData.agent_summary,
    })
  } catch (error) {
    console.error('Error fetching crate summary:', error)
    return c.json(
      {
        success: false,
        error: 'Failed to fetch crate summary',
        details: String(error),
      },
      { status: 500 },
    )
  }
})

// Get crate summary
app.get('/crates/:name/:version/debug', async (c) => {
  const { name, version } = c.req.param()

  try {
    const crate = await c.env.CRATES_STORAGE.list({
      prefix: `crates/${name}/${version}/`,
    })
    return c.json({
      success: true,
      files: crate.objects.map((f) => f.key),
    })
  } catch (error) {
    console.error('Error fetching crate summary:', error)
    return c.json(
      {
        success: false,
        error: 'Failed to fetch crate summary',
        details: String(error),
      },
      { status: 500 },
    )
  }
})

// Get function usage details
app.get('/crates/:name/:version/function', async (c) => {
  const { name, version } = c.req.param()
  const path = c.req.query('path')

  if (!path) {
    return c.json(
      {
        success: false,
        error: 'path query parameter is required',
      },
      { status: 400 },
    )
  }

  const segments = path.split('::')
  const pathToFunction = segments.join('/')

  try {
    // Construct R2 key from path parameters
    const r2Key = `crates/${name}/${version}/${pathToFunction}.json`

    // Retrieve the item's JSON file from R2
    const itemObj = await c.env.CRATES_STORAGE.get(r2Key)

    if (!itemObj) {
      return c.json(
        {
          success: false,
          error: 'Function not found',
        },
        { status: 404 },
      )
    }

    // Return the full JSON object
    const itemData: ItemInfo = await itemObj.json()
    const functionDetails = (itemData.details as { function: FunctionDetails })
      .function
    return c.json({
      success: true,
      data: {
        signature: functionDetails.signature,
        agent_summary: itemData.agent_summary || 'No summary available',
      },
    })
  } catch (error) {
    console.error('Error fetching function:', error)
    return c.json(
      {
        success: false,
        error: 'Failed to fetch function',
        details: String(error),
      },
      { status: 500 },
    )
  }
})

// Query crate
app.post(
  '/crates/:name/:version/query',
  zValidator('json', z.object({ query: z.string() })),
  async (c) => {
    const { name, version } = c.req.param()
    const { query } = c.req.valid('json')

    try {
      // Use AUTORAG aiSearch with filtering by crateName and version
      const results = await c.env.AUTORAG.aiSearch({
        query,
        filter: {
          crateName: name,
          version: version,
        },
      })

      return c.json({
        success: true,
        results,
      })
    } catch (error) {
      console.error('Error querying crate:', error)
      return c.json(
        {
          success: false,
          error: 'Failed to query crate',
          details: String(error),
        },
        { status: 500 },
      )
    }
  },
)

app.all('*', (c) => {
  return c.json(
    {
      success: false,
      error: 'Not Found',
    },
    { status: 404 },
  )
})

export default app
