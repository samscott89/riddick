import type {
  ParsedItem,
  ParseResult,
  SourceLocation,
  ParsedCrate,
  ParsedModule,
  ParserOptions,
} from './types'
// Import WASM directly using Workers' native support
import init, { parse_rust_code } from './wasm/rust_parser.js'
import wasmModule from './wasm/rust_parser_bg.wasm'

// Type definitions for WASM response
interface ParseResponse {
  success: boolean
  parseTime: number
  crateInfo?: CrateInfo
  errors: Array<{
    message: string
    severity: string
    location?: LocationInfo
  }>
}

interface CrateInfo {
  name: string
  modules: ModuleInfo[]
  rootModule: ModuleInfo
}

interface ModuleInfo {
  name: string
  path: string
  items: ItemInfo[]
  location: LocationInfo
}

interface ItemInfo {
  type: string
  name: string
  visibility: string
  location: LocationInfo
  sourceCode?: string
  attributes?: string[]
  genericParameters?: string[]
  parameters?: ParameterInfo[]
  returnType?: string
  fields?: FieldInfo[]
  variants?: VariantInfo[]
  implType?: string
  traitName?: string
}

interface ParameterInfo {
  name: string
  paramType: string
  isSelf: boolean
  isMutable: boolean
}

interface FieldInfo {
  name: string
  fieldType: string
  visibility: string
}

interface VariantInfo {
  name: string
  discriminant?: string
}

interface LocationInfo {
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
  startByte: number
  endByte: number
}

let wasmInitialized = false

async function ensureWasmInitialized(): Promise<void> {
  if (!wasmInitialized) {
    try {
      await init({ module_or_path: wasmModule })
      wasmInitialized = true
    } catch (error) {
      throw new Error(`Failed to initialize WASM parser: ${error}`)
    }
  }
}

export async function parseRustCode(
  code: string,
  _options: ParserOptions = {},
): Promise<ParseResult> {
  await ensureWasmInitialized()
  try {
    const result = parse_rust_code(code) as ParseResponse

    // The result should match our ParseResponse type from the Rust code
    return {
      success: result.success,
      parseTime: result.parseTime,
      crate: result.crateInfo ? mapCrateInfo(result.crateInfo) : null,
      errors: result.errors.map((error) => ({
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

function mapCrateInfo(crateInfo: CrateInfo): ParsedCrate {
  return {
    name: crateInfo.name,
    modules: crateInfo.modules.map(mapModuleInfo),
    rootModule: mapModuleInfo(crateInfo.rootModule),
    errors: [], // Errors are handled separately
  }
}

function mapModuleInfo(moduleInfo: ModuleInfo): ParsedModule {
  return {
    name: moduleInfo.name,
    path: moduleInfo.path,
    items: moduleInfo.items.map(mapItemInfo),
    submodules: [], // WASM parser doesn't have nested modules yet
    location: mapLocation(moduleInfo.location),
  }
}

function mapItemInfo(itemInfo: ItemInfo): ParsedItem {
  return {
    type: itemInfo.type as ParsedItem['type'], // Type assertion needed for enum conversion
    name: itemInfo.name,
    visibility: itemInfo.visibility,
    location: mapLocation(itemInfo.location),
    sourceCode: itemInfo.sourceCode,
    attributes: itemInfo.attributes,
    genericParameters: itemInfo.genericParameters,
    parameters: itemInfo.parameters?.map((param) => ({
      name: param.name,
      type: param.paramType,
      isSelf: param.isSelf,
      isMutable: param.isMutable,
    })),
    returnType: itemInfo.returnType,
    fields: itemInfo.fields?.map((field) => ({
      name: field.name,
      type: field.fieldType,
      visibility: field.visibility,
    })),
    variants: itemInfo.variants?.map((variant) => ({
      name: variant.name,
      discriminant: variant.discriminant,
    })),
    implType: itemInfo.implType,
    traitName: itemInfo.traitName,
  }
}

function mapLocation(location: LocationInfo): SourceLocation {
  return {
    startLine: location.startLine,
    startColumn: location.startColumn,
    endLine: location.endLine,
    endColumn: location.endColumn,
    startByte: location.startByte,
    endByte: location.endByte,
  }
}
