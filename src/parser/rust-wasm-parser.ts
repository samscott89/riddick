import {
  ParsedItem,
  ParseResult,
  SourceLocation,
  ParsedCrate,
  ParserOptions,
} from './types'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Different approaches for browser vs Node.js
let wasmModule: any = null
let wasmInitialized = false

async function ensureWasmInitialized() {
  if (!wasmInitialized) {
    const wasmInit = await import('./wasm/rust_parser.js')

    let wasmBytes: ArrayBuffer
    if (typeof window === 'undefined') {
      // Node.js environment (tests)
      const __filename = fileURLToPath(import.meta.url)
      const __dirname = dirname(__filename)
      const wasmPath = join(__dirname, 'wasm', 'rust_parser_bg.wasm')
      wasmBytes = readFileSync(wasmPath).buffer
    } else {
      // Browser environment
      const wasmUrl = new URL('./wasm/rust_parser_bg.wasm', import.meta.url)
      const response = await fetch(wasmUrl)
      wasmBytes = await response.arrayBuffer()
    }

    await wasmInit.default(wasmBytes)
    wasmInit.init() // Initialize panic hook
    wasmModule = wasmInit
    wasmInitialized = true
  }
}

export async function parseRustCode(
  code: string,
  _options: ParserOptions = {},
): Promise<ParseResult> {
  try {
    await ensureWasmInitialized()

    const result = wasmModule.parse_rust_code(code)

    // The result should match our ParseResponse type from the Rust code
    return {
      success: result.success,
      parseTime: result.parseTime,
      crate: result.crateInfo ? mapCrateInfo(result.crateInfo) : null,
      errors: result.errors.map((error: any) => ({
        message: error.message,
        severity: error.severity as 'error' | 'warning',
        location: error.location ? mapLocation(error.location) : undefined,
      })),
    }
  } catch (error) {
    return {
      success: false,
      parseTime: 0,
      crate: null,
      errors: [
        {
          message: `WASM parser error: ${error}`,
          severity: 'error' as const,
        },
      ],
    }
  }
}

function mapCrateInfo(crateInfo: any): ParsedCrate {
  return {
    name: crateInfo.name,
    modules: crateInfo.modules.map(mapModuleInfo),
    rootModule: mapModuleInfo(crateInfo.rootModule),
    errors: [], // Errors are handled separately
  }
}

function mapModuleInfo(moduleInfo: any) {
  return {
    name: moduleInfo.name,
    path: moduleInfo.path,
    items: moduleInfo.items.map(mapItemInfo),
    submodules: [], // WASM parser doesn't have nested modules yet
    location: mapLocation(moduleInfo.location),
  }
}

function mapItemInfo(itemInfo: any): ParsedItem {
  return {
    type: itemInfo.type as any, // Type assertion needed for enum conversion
    name: itemInfo.name,
    visibility: itemInfo.visibility,
    location: mapLocation(itemInfo.location),
    sourceCode: itemInfo.sourceCode,
    attributes: itemInfo.attributes,
    genericParameters: itemInfo.genericParameters,
    parameters: itemInfo.parameters?.map((param: any) => ({
      name: param.name,
      type: param.paramType,
      isSelf: param.isSelf,
      isMutable: param.isMutable,
    })),
    returnType: itemInfo.returnType,
    fields: itemInfo.fields?.map((field: any) => ({
      name: field.name,
      type: field.fieldType,
      visibility: field.visibility,
    })),
    variants: itemInfo.variants?.map((variant: any) => ({
      name: variant.name,
      discriminant: variant.discriminant,
    })),
    implType: itemInfo.implType,
    traitName: itemInfo.traitName,
  }
}

function mapLocation(location: any): SourceLocation {
  return {
    startLine: location.startLine,
    startColumn: location.startColumn,
    endLine: location.endLine,
    endColumn: location.endColumn,
    startByte: location.startByte,
    endByte: location.endByte,
  }
}
