import type { ItemInfo as ParsedItemInfo } from './rust_parser_generated/ItemInfo'
import type { FileInfo as ParsedFileInfo } from './rust_parser_generated/FileInfo'

// Direct re-exports of generated types
export type { AdtDetails } from './rust_parser_generated/AdtDetails'
export type { FunctionDetails } from './rust_parser_generated/FunctionDetails'
export type { ItemDetails } from './rust_parser_generated/ItemDetails'
export type { ModuleDetails } from './rust_parser_generated/ModuleDetails'
export type { ModuleInfo } from './rust_parser_generated/ModuleInfo'
export type { ModuleReference } from './rust_parser_generated/ModuleReference'
export type { OtherDetails } from './rust_parser_generated/OtherDetails'
export type { ParseError } from './rust_parser_generated/ParseError'
export type { ParseRequest } from './rust_parser_generated/ParseRequest'
export type { ParseResponse } from './rust_parser_generated/ParseResponse'
export type { TraitDetails } from './rust_parser_generated/TraitDetails'
export type { TraitMethodInfo } from './rust_parser_generated/TraitMethodInfo'

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
  PROCESSING = 'processing',
  SUMMARIZING = 'summarizing',
  COMPLETE = 'complete',
  FAILED = 'failed',
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

export interface CreateCrateRequest {
  name: string
  version: string
  agent_summary?: string
  status?: CrateStatus
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

// Shared types between api-worker and crate-processor

export interface QueueMessage {
  crateId: number
  crateName: string
  version: string
  stage?: 'fetch' | 'parse' | 'summarize'
  created_at?: string
}

export interface CrateWithData {
  name: string
  version: string
  files: Map<string, string>
}

// Extended type to include AI-generated summary
export interface ItemInfo extends ParsedItemInfo {
  agent_summary?: string
}
export interface FileInfo extends ParsedFileInfo {
  agent_summary?: string
}
