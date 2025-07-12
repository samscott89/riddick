// Direct re-exports of generated types - no more manual types!
export type { CrateInfo } from './generated/CrateInfo'
export type { FieldInfo } from './generated/FieldInfo'
export type { ItemInfo } from './generated/ItemInfo'
export type { ModuleInfo } from './generated/ModuleInfo'
export type { ParameterInfo } from './generated/ParameterInfo'
export type { ParseError } from './generated/ParseError'
export type { ParseRequest } from './generated/ParseRequest'
export type { ParseResponse } from './generated/ParseResponse'
export type { SourceLocation } from './generated/SourceLocation'
export type { VariantInfo } from './generated/VariantInfo'


// Keep the ItemType enum as it's useful
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

// ParserOptions for function parameters (optional fields)
export interface ParserOptions {
  includeComments?: boolean
  includeDocComments?: boolean
  includePrivateItems?: boolean
  maxDepth?: number
  timeout?: number
}
