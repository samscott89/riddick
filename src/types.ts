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

export enum ItemType {
  FUNCTION = 'function',
  STRUCT = 'struct',
  ENUM = 'enum',
  IMPL = 'impl',
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
  item_type: ItemType
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
