// Parser endpoint for testing Rust code parsing in Cloudflare Workers
import { parseRustCode } from './parser'
import type { ParseRequest, ParseResponse } from './parser/types'


export async function handleParseRequest(
  request: ParseRequest,
): Promise<ParseResponse> {
  return  await parseRustCode(request.code)
}

// Example usage for testing
export const EXAMPLE_REQUESTS: ParseRequest[] = [
  {
    code: `
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}
    `,
    // options: { includeComments: false },
  },
  {
    code: `
pub struct Point {
    pub x: f64,
    pub y: f64,
}

impl Point {
    pub fn new(x: f64, y: f64) -> Self {
        Point { x, y }
    }
}
    `,
    // options: { includePrivateItems: false },
  },
  {
    code: `
#[derive(Debug, Clone)]
pub enum Status {
    Active,
    Inactive,
    Pending { reason: String },
}
    `,
  },
]
