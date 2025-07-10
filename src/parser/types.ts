export interface SourceLocation {
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
  startByte: number
  endByte: number
}

export enum ItemType {
  FUNCTION = 'function',
  STRUCT = 'struct',
  ENUM = 'enum',
  IMPL = 'impl',
  MOD = 'mod',
  TRAIT = 'trait',
  TYPE_ALIAS = 'type_alias',
  CONST = 'const',
  STATIC = 'static',
  USE = 'use',
  MACRO = 'macro',
}

export interface ParsedItem {
  type: ItemType
  name: string
  sourceCode: string
  location: SourceLocation
  visibility?: 'pub' | 'pub(crate)' | 'pub(super)' | 'pub(in path)' | 'private'
  attributes?: string[]
  genericParameters?: string[]
  // Type-specific fields
  parameters?: FunctionParameter[]
  returnType?: string
  fields?: StructField[]
  variants?: EnumVariant[]
  traitName?: string
  implType?: string
  associatedItems?: ParsedItem[]
}

export interface FunctionParameter {
  name: string
  type: string
  isSelf?: boolean
  isMutable?: boolean
}

export interface StructField {
  name: string
  type: string
  visibility?: 'pub' | 'pub(crate)' | 'pub(super)' | 'pub(in path)' | 'private'
}

export interface EnumVariant {
  name: string
  fields?: StructField[]
  discriminant?: string
}

export interface ParsedModule {
  name: string
  path: string
  items: ParsedItem[]
  location: SourceLocation
  visibility?: 'pub' | 'pub(crate)' | 'pub(super)' | 'pub(in path)' | 'private'
  attributes?: string[]
  submodules?: ParsedModule[]
}

export interface ParsedCrate {
  name: string
  modules: ParsedModule[]
  rootModule: ParsedModule
  errors: ParseError[]
}

export interface ParseError {
  message: string
  location?: SourceLocation
  severity: 'error' | 'warning'
}

export interface ParserOptions {
  includeComments?: boolean
  includeDocComments?: boolean
  includePrivateItems?: boolean
  maxDepth?: number
  timeout?: number
}

export interface ParseResult {
  crate: ParsedCrate | null
  errors: ParseError[]
  success: boolean
  parseTime: number
}
