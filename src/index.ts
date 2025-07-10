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

    return new Response('Not Found', { status: 404 })
  },
} satisfies ExportedHandler<Env>
