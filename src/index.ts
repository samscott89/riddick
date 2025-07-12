import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { bearerAuth } from 'hono/bearer-auth'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { z } from 'zod'

import { handleParseRequest, EXAMPLE_REQUESTS } from './parser-endpoint'
import { parseRustCode } from './parser'

type Bindings = {
  API_KEY: string
  CRATE_QUEUE: Queue
  DB: D1Database
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

// Paste this code at the end of the src/index.ts file

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
      // Check if crate already exists
      const existingCrate = await c.env.DB.prepare(
        'SELECT id, status FROM crates WHERE name = ? AND version = ?'
      ).bind(crate_name, version).first()
      
      if (existingCrate) {
        return c.json({
          success: true,
          message: 'Crate already exists',
          crate_id: existingCrate.id,
          status: existingCrate.status,
        })
      }
      
      // Insert new crate record
      const insertResult = await c.env.DB.prepare(
        'INSERT INTO crates (name, version, status, created_at) VALUES (?, ?, ?, ?)'
      ).bind(crate_name, version, 'queued', new Date().toISOString()).run()
      
      const crateId = insertResult.meta.last_row_id
      
      // Queue the processing task
      await c.env.CRATE_QUEUE.send({
        crate_id: crateId,
        crate_name,
        version,
        stage: 'fetch',
        created_at: new Date().toISOString(),
      })
      
      return c.json({
        success: true,
        message: 'Crate queued for processing',
        crate_id: crateId,
        status: 'queued',
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

// Queue consumer for processing crate tasks
export async function queue(batch: MessageBatch<any>, env: Bindings): Promise<void> {
  for (const message of batch.messages) {
    const { crate_id, crate_name, version, stage } = message.body
    
    try {
      console.log(`Processing crate ${crate_name}:${version} (${crate_id}) - stage: ${stage}`)
      
      switch (stage) {
        case 'fetch':
          await processFetchStage(crate_id, crate_name, version, env)
          break
        case 'parse':
          await processParseStage(crate_id, crate_name, version, env)
          break
        case 'summarize':
          await processSummarizeStage(crate_id, crate_name, version, env)
          break
        default:
          console.error(`Unknown stage: ${stage}`)
      }
    } catch (error) {
      console.error(`Error processing crate ${crate_name}:${version}:`, error)
      // Update status to failed
      await env.DB.prepare(
        'UPDATE crates SET status = ?, updated_at = ? WHERE id = ?'
      ).bind('failed', new Date().toISOString(), crate_id).run()
      
      throw error // Re-throw to trigger retry mechanism
    }
  }
}

async function processFetchStage(crateId: number, crateName: string, version: string, env: Bindings): Promise<void> {
  // Update status to fetching
  await env.DB.prepare(
    'UPDATE crates SET status = ?, updated_at = ? WHERE id = ?'
  ).bind('fetching', new Date().toISOString(), crateId).run()
  
  // Fetch the crate tarball
  const downloadUrl = `https://crates.io/api/v1/crates/${crateName}/${version}/download`
  const response = await fetch(downloadUrl)
  
  if (!response.ok) {
    if (response.status === 404) {
      await env.DB.prepare(
        'UPDATE crates SET status = ?, updated_at = ? WHERE id = ?'
      ).bind('not_found', new Date().toISOString(), crateId).run()
      return
    }
    throw new Error(`Failed to fetch crate: ${response.status}`)
  }
  
  const tarballBuffer = await response.arrayBuffer()
  
  // Store the tarball (you might want to store this in R2 for larger files)
  await env.DB.prepare(
    'UPDATE crates SET tarball_data = ?, status = ?, updated_at = ? WHERE id = ?'
  ).bind(new Uint8Array(tarballBuffer), 'fetched', new Date().toISOString(), crateId).run()
  
  // Queue the next stage
  await env.CRATE_QUEUE.send({
    crate_id: crateId,
    crate_name: crateName,
    version,
    stage: 'parse',
    created_at: new Date().toISOString(),
  })
}

async function processParseStage(crateId: number, crateName: string, version: string, env: Bindings): Promise<void> {
  // Update status to parsing
  await env.DB.prepare(
    'UPDATE crates SET status = ?, updated_at = ? WHERE id = ?'
  ).bind('parsing', new Date().toISOString(), crateId).run()
  
  // Get the tarball data
  const crateData = await env.DB.prepare(
    'SELECT tarball_data FROM crates WHERE id = ?'
  ).bind(crateId).first()
  
  if (!crateData?.tarball_data) {
    throw new Error('No tarball data found')
  }
  
  // Extract and parse the crate
  // This is a simplified version - you'd need to implement tarball extraction
  // and iterate through .rs files
  try {
    // TODO: Implement actual tarball extraction and parsing
    // For now, we'll simulate the parsing process
    
    // Insert dummy module and item data
    await env.DB.prepare(
      'INSERT INTO modules (crate_id, name, path, parent_id) VALUES (?, ?, ?, ?)'
    ).bind(crateId, 'lib', 'src/lib.rs', null).run()
    
    const moduleResult = await env.DB.prepare(
      'SELECT id FROM modules WHERE crate_id = ? AND name = ?'
    ).bind(crateId, 'lib').first()
    
    if (moduleResult) {
      await env.DB.prepare(
        'INSERT INTO items (module_id, name, item_type, source_code, visibility) VALUES (?, ?, ?, ?, ?)'
      ).bind(moduleResult.id, 'example_function', 'function', 'pub fn example_function() {}', 'public').run()
    }
    
    // Update status to parsed
    await env.DB.prepare(
      'UPDATE crates SET status = ?, updated_at = ? WHERE id = ?'
    ).bind('parsed', new Date().toISOString(), crateId).run()
    
    // Queue the next stage
    await env.CRATE_QUEUE.send({
      crate_id: crateId,
      crate_name: crateName,
      version,
      stage: 'summarize',
      created_at: new Date().toISOString(),
    })
    
  } catch (error) {
    console.error('Parse error:', error)
    throw error
  }
}

async function processSummarizeStage(crateId: number, crateName: string, version: string, env: Bindings) {
  // Update status to summarizing
  await env.DB.prepare(
    'UPDATE crates SET status = ?, updated_at = ? WHERE id = ?'
  ).bind('summarizing', new Date().toISOString(), crateId).run()
  
  // This is where you'd implement the AI summarization workflow
  // For now, we'll just mark it as complete
  
  // Update status to complete
  await env.DB.prepare(
    'UPDATE crates SET status = ?, updated_at = ? WHERE id = ?'
  ).bind('complete', new Date().toISOString(), crateId).run()
  
  console.log(`Crate ${crateName}:${version} processing complete`)
}

export default app
