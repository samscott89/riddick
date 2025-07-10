// Parser endpoint for testing Rust code parsing in Cloudflare Workers
import { parseRustCode } from './parser'

export interface ParserRequest {
  code: string
  options?: {
    includeComments?: boolean
    includeDocComments?: boolean
    includePrivateItems?: boolean
    timeout?: number
  }
}

export interface ParserResponse {
  success: boolean
  parseTime: number
  itemCount: number
  errors: Array<{ message: string; severity: string; location?: any }>
  items?: Array<{
    type: string
    name: string
    visibility?: string
    location: {
      startLine: number
      endLine: number
    }
  }>
}

export async function handleParseRequest(request: ParserRequest): Promise<ParserResponse> {
  const startTime = Date.now()
  
  try {
    const result = await parseRustCode(request.code, request.options || {})
    
    const response: ParserResponse = {
      success: result.success,
      parseTime: result.parseTime,
      itemCount: result.crate?.rootModule.items.length || 0,
      errors: result.errors.map(error => ({
        message: error.message,
        severity: error.severity,
        location: error.location,
      })),
    }
    
    // Include parsed items if successful
    if (result.success && result.crate) {
      response.items = result.crate.rootModule.items.map(item => ({
        type: item.type,
        name: item.name,
        visibility: item.visibility,
        location: {
          startLine: item.location.startLine,
          endLine: item.location.endLine,
        },
      }))
    }
    
    return response
  } catch (error) {
    return {
      success: false,
      parseTime: Date.now() - startTime,
      itemCount: 0,
      errors: [
        {
          message: `Parser error: ${error}`,
          severity: 'error',
        },
      ],
    }
  }
}

// Example usage for testing
export const EXAMPLE_REQUESTS: ParserRequest[] = [
  {
    code: `
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}
    `,
    options: { includeComments: false },
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
    options: { includePrivateItems: false },
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