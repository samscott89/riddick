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