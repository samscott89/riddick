import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { bearerAuth } from 'hono/bearer-auth'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { z } from 'zod'

import { handleParseRequest, EXAMPLE_REQUESTS } from './parser-endpoint'

type Bindings = {
  API_KEY: string
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
