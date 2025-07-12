// Direct re-exports of generated types
export type { CrateInfo } from './rust_parser_generated/CrateInfo'
export type { FieldInfo } from './rust_parser_generated/FieldInfo'
export type { ItemInfo } from './rust_parser_generated/ItemInfo'
export type { ModuleInfo } from './rust_parser_generated/ModuleInfo'
export type { ParameterInfo } from './rust_parser_generated/ParameterInfo'
export type { ParseError } from './rust_parser_generated/ParseError'
export type { ParseRequest } from './rust_parser_generated/ParseRequest'
export type { ParseResponse } from './rust_parser_generated/ParseResponse'
export type { SourceLocation } from './rust_parser_generated/SourceLocation'
export type { VariantInfo } from './rust_parser_generated/VariantInfo'

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

export enum CrateStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  FETCHING = 'fetching',
  FETCHED = 'fetched',
  PARSING = 'parsing',
  PARSED = 'parsed',
  SUMMARIZING = 'summarizing',
  COMPLETE = 'complete',
  FAILED = 'failed',
  NOT_FOUND = 'not_found',
}

export interface Crate {
  id: number
  name: string
  version: string
  agent_summary: string | null
  status: CrateStatus
  error_message: string | null
  created_at: string
}

export interface Module {
  id: number
  crate_id: number
  path: string
  agent_summary: string | null
}

export interface Item {
  id: number
  module_id: number
  name: string
  item_type: ItemType
  source_code: string
  agent_summary: string | null
}

export interface CreateCrateRequest {
  name: string
  version: string
  agent_summary?: string
  status?: CrateStatus
}

export interface CreateModuleRequest {
  crate_id: number
  path: string
  agent_summary?: string
}

export interface CreateItemRequest {
  module_id: number
  name: string
  item_type: string
  source_code: string
  agent_summary?: string
}

export interface UpdateCrateStatusRequest {
  id: number
  status: CrateStatus
  error_message?: string
}

export interface UpdateSummaryRequest {
  id: number
  summary: string
}

export interface BatchCreateItemsRequest {
  items: CreateItemRequest[]
}

// Shared types between api-worker and crate-processor

export interface QueueMessage {
  crate_id: number
  crate_name: string
  version: string
  stage: 'fetch' | 'parse' | 'summarize'
  created_at: string
}

export interface ProcessingStage {
  stage: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  error_message?: string
  updated_at: string
}
