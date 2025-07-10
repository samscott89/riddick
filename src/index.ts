import { handleParseRequest, EXAMPLE_REQUESTS } from './parser-endpoint'

export interface Env {
  DB: D1Database
  [key: string]: unknown
}

export default {
  async fetch(
    request: Request,
    _env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/health' && request.method === 'GET') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Parser test endpoint
    if (url.pathname === '/parse' && request.method === 'POST') {
      try {
        const parseRequest = (await request.json()) as { code: string }
        const result = await handleParseRequest(parseRequest)

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        })
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            error: String(error),
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        )
      }
    }

    // Parser test examples endpoint
    if (url.pathname === '/parse/examples' && request.method === 'GET') {
      return new Response(JSON.stringify(EXAMPLE_REQUESTS), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    }

    // Parser test with example
    if (url.pathname === '/parse/test' && request.method === 'GET') {
      try {
        const result = await handleParseRequest(EXAMPLE_REQUESTS[0])

        return new Response(
          JSON.stringify({
            request: EXAMPLE_REQUESTS[0],
            result,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        )
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            error: String(error),
          }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        )
      }
    }

    return new Response('Not Found', { status: 404 })
  },
} satisfies ExportedHandler<Env>
