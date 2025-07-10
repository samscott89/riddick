export * from './types'
export * from './wasm-parser'
export * from './queries'
export * from './error-handler'

// Re-export main classes for convenience
export { WasmRustParser, createWasmRustParser, parseRustCodeWasm } from './wasm-parser'
export {
  ParseErrorHandler,
  ValidationError,
  validateRustCode,
} from './error-handler'

// Convenience aliases for main parser
export { WasmRustParser as RustParser, createWasmRustParser as createRustParser, parseRustCodeWasm as parseRustCode } from './wasm-parser'
