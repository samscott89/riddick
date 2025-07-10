// Example Cloudflare Worker using the WASM Rust parser
import { WasmRustParser } from '../src/parser/wasm-parser'

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    // Only handle POST requests to /parse
    if (request.method === 'POST' && new URL(request.url).pathname === '/parse') {
      try {
        const { code } = await request.json()
        
        if (!code || typeof code !== 'string') {
          return new Response('Invalid request: code field required', { status: 400 })
        }

        // Initialize the WASM parser
        const parser = new WasmRustParser()
        await parser.initialize()

        // Parse the Rust code
        const result = await parser.parseString(code)

        // Clean up
        parser.dispose()

        // Return the parsed result
        return new Response(JSON.stringify(result, null, 2), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        })
      } catch (error) {
        return new Response(
          JSON.stringify({ 
            error: 'Failed to parse Rust code', 
            message: error instanceof Error ? error.message : String(error) 
          }), 
          { 
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        )
      }
    }

    // Return 404 for other requests
    return new Response('Not found', { status: 404 })
  },
}

// Example usage (in a browser):
/*
fetch('https://your-worker.yourname.workers.dev/parse', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    code: `
      fn main() {
          println!("Hello, world!");
      }
      
      #[derive(Debug)]
      pub struct Point {
          x: f64,
          y: f64,
      }
      
      impl Point {
          pub fn new(x: f64, y: f64) -> Self {
              Point { x, y }
          }
          
          pub fn distance(&self, other: &Point) -> f64 {
              ((self.x - other.x).powi(2) + (self.y - other.y).powi(2)).sqrt()
          }
      }
    `
  })
})
.then(response => response.json())
.then(result => {
  console.log('Parsed Rust code:', result);
  if (result.success) {
    console.log('Found items:', result.crate.rootModule.items.map(item => ({
      type: item.type,
      name: item.name,
      visibility: item.visibility
    })));
  } else {
    console.log('Parse errors:', result.errors);
  }
})
.catch(error => console.error('Error:', error));
*/