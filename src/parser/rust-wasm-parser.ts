import type { ParseResponse, ParserOptions } from './types'
// Import WASM directly using Workers' native support
import init, { parse_rust_code } from './wasm/rust_parser.js'
import wasmModule from './wasm/rust_parser_bg.wasm'

let wasmInitialized = false

async function ensureWasmInitialized(): Promise<void> {
  if (!wasmInitialized) {
    try {
      await init({ module_or_path: wasmModule })
      wasmInitialized = true
    } catch (error) {
      throw new Error(`Failed to initialize WASM parser: ${error as string}`)
    }
  }
}

export async function parseRustCode(
  code: string,
  _options: ParserOptions = {},
): Promise<ParseResponse> {
  await ensureWasmInitialized()
  try {
    const result = parse_rust_code(code) as ParseResponse
    // console.log('WASM parse result:', result.parseTime)

    // The result should match our ParseResponse type from the Rust code
    return {
      success: result.success,
      parseTime: result.parseTime,
      crateInfo: result.crateInfo,
      errors: result.errors.map((error) => ({
        message: error.message,
        severity: error.severity as 'error' | 'warning',
        location: error.location,
      })),
    }
  } catch (error) {
    return {
      success: false,
      parseTime: BigInt(0),
      crateInfo: null,
      errors: [
        {
          message: `WASM parser error: ${error as string}`,
          severity: 'error' as const,
          location: null,
        },
      ],
    }
  }
}
