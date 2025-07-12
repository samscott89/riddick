import {
  WorkflowEntrypoint,
  type WorkflowStep,
  type WorkflowEvent,
} from 'cloudflare:workers'
import { DatabaseService } from '@riddick/database'
import {
  CrateStatus,
  type QueueMessage,
  type CrateWithData,
  type ParseResponse,
} from '@riddick/types'
import { TarExtractor } from './extractor'
import { NonRetryableError } from 'cloudflare:workflows'

interface RustParser extends Fetcher {
  parse_rust_code(input: { code: string; option?: any }): Promise<ParseResponse>
}

export interface Env {
  DB: D1Database
  CRATE_BUCKET: R2Bucket
  RUST_PARSER: RustParser
  CRATE_WORKFLOW: Workflow
  CRATE_QUEUE: Queue<QueueMessage>
  AI: Ai
}

interface CrateProcessingParams {
  crateId: number
  crateName: string
  version: string
}

export class CrateProcessingWorkflow extends WorkflowEntrypoint<
  Env,
  CrateProcessingParams
> {
  async run(event: WorkflowEvent<CrateProcessingParams>, step: WorkflowStep) {
    console.log(
      `Starting crate processing for ${event.payload.crateName} v${event.payload.version}`,
    )
    const { crateId, crateName, version } = event.payload
    const db = new DatabaseService(this.env.DB)

    await step.do('update-status-processing', async () => {
      await db.updateCrateProgress(crateId, CrateStatus.PARSING)
    })

    let crateData: CrateWithData

    try {
      crateData = await step.do('fetch-crate-data', async () => {
        return await this.fetchCrateData(crateName, version)
      })

      const parsedData = await step.do('parse-rust-files', async () => {
        return await this.parseRustFiles(crateData.files)
      })

      await step.do('store-parsed-data', async () => {
        await this.storeParsedData(crateId, parsedData)
      })

      await step.do('generate-summaries', async () => {
        await this.generateSummaries(crateId)
      })

      await step.do('update-status-completed', async () => {
        await db.updateCrateProgress(crateId, CrateStatus.COMPLETE)
      })
    } catch (error) {
      await step.do('update-status-failed', async () => {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        await db.updateCrateProgress(crateId, CrateStatus.FAILED, errorMessage)
      })
      throw error
    }
  }

  private async fetchCrateData(
    crateName: string,
    version: string,
  ): Promise<CrateWithData> {
    const key = `${crateName}-${version}.tar.gz`

    // first, check if the crate already exists in R2
    const existingCrate = await this.env.CRATE_BUCKET.get(key)
    let tarballBuffer: ArrayBuffer
    if (existingCrate) {
      console.log(`Found existing crate ${crateName} v${version} in R2`)
      tarballBuffer = await existingCrate.arrayBuffer()
    } else {
      console.log(
        `Crate ${crateName} v${version} not found in R2, downloading...`,
      )
      // Download crate from crates.io
      const response = await fetch(
        `https://crates.io/api/v1/crates/${crateName}/${version}/download`,
      )

      if (response.status in [403, 404]) {
        throw new NonRetryableError(
          `Crate ${crateName} v${version} not found on crates.io`,
        )
      }
      if (!response.ok) {
        throw new Error(`Failed to download crate: ${response.statusText}`)
      }

      tarballBuffer = await response.arrayBuffer()

      // Store in R2 for future use
      await this.env.CRATE_BUCKET.put(key, tarballBuffer)
    }

    // Extract and read Rust files
    const files = await this.extractRustFiles(new Uint8Array(tarballBuffer))

    return {
      name: crateName,
      version,
      files,
    }
  }

  private async extractRustFiles(
    tarballData: Uint8Array,
  ): Promise<Array<{ path: string; content: string }>> {
    return await TarExtractor.extractRustFiles(tarballData)
  }

  private async parseRustFiles(
    files: Array<{ path: string; content: string }>,
  ): Promise<Array<{ path: string; content: string; parsed: any }>> {
    const parsedFiles = []

    for (const file of files) {
      try {
        const response = await this.env.RUST_PARSER.parse_rust_code({
          code: file.content,
        })

        if (response.success) {
          parsedFiles.push({
            path: file.path,
            content: file.content,
            parsed: response.crateInfo,
          })
        } else {
          throw new NonRetryableError(
            `Failed to parse file ${file.path}:\n\t${response.errors.join('\n\t')}`,
          )
        }
      } catch (error) {
        throw new NonRetryableError(
          `Failed to parse file ${file.path}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    return parsedFiles
  }

  private async storeParsedData(
    crateId: number,
    parsedFiles: Array<{ path: string; content: string; parsed: any }>,
  ) {
    const db = new DatabaseService(this.env.DB)

    for (const file of parsedFiles) {
      // Create module for each file
      const module = await db.modules.createModule({
        crate_id: crateId,
        path: file.path,
        agent_summary: undefined,
      })

      // Store items from parsed data
      if (file.parsed.items) {
        for (const item of file.parsed.items) {
          await db.items.createItem({
            module_id: module.id,
            name: item.name,
            item_type: item.item_type,
            source_code: file.content,
            agent_summary: undefined,
          })
        }
      }
    }
  }

  private async generateSummaries(crateId: number) {
    const db = new DatabaseService(this.env.DB)

    // Get crate data
    const { crate, modules, items } =
      await db.getCrateWithModulesAndItems(crateId)
    if (!crate) return

    // Generate crate-level summary
    const crateContext = modules.map((m) => `Module: ${m.path}`).join('\n\n')

    const _crateSummary = await this.generateAISummary(
      `Summarize this Rust crate "${crate.name}" based on its modules:

${crateContext}

Provide a concise summary of what this crate does, its main purpose, and key functionality.`,
    )

    // Update crate with summary (assuming the repo has an update method)
    // For now, we'll skip the crate update as the interface isn't clear

    // Generate module summaries
    for (const module of modules) {
      const moduleItems = items.filter((item) => item.module_id === module.id)
      const itemsContext = moduleItems
        .map((item) => `${item.item_type}: ${item.name}`)
        .join('\n')

      if (itemsContext) {
        const _moduleSummary = await this.generateAISummary(
          `Summarize this Rust module "${module.path}" based on its contents:

${itemsContext}

Explain what this module does and its role in the crate.`,
        )

        // For now, we'll skip module updates as the interface isn't clear
      }
    }

    // For now, we'll skip item updates as the interface isn't clear
    console.log(
      `Generated summaries for crate ${crateId} with ${modules.length} modules and ${items.length} items`,
    )
  }

  private async generateAISummary(prompt: string): Promise<string> {
    try {
      // const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      //   messages: [
      //     {
      //       role: 'system',
      //       content:
      //         'You are a helpful assistant that explains Rust code. Be concise and technical.',
      //     },
      //     {
      //       role: 'user',
      //       content: prompt,
      //     },
      //   ],
      //   max_tokens: 200,
      // })

      return 'AI summary placeholder'
    } catch (error) {
      console.warn('AI summary generation failed:', error)
      return 'AI summary unavailable'
    }
  }
}

export default {
  async queue(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const { crateId, crateName, version } = message.body
      console.log(`Processing crate ${crateName} v${version} (ID: ${crateId})`)

      // Start workflow for this crate
      const workflowId = `crate-${crateId}-${Date.now()}`
      const workflow: WorkflowInstance = await env.CRATE_WORKFLOW.create({
        id: workflowId,
        params: { crateId, crateName, version },
      })
      console.log(
        `Started workflow ${workflowId} for crate ${crateName} v${version}`,
      )
      const status = await workflow.status()
      console.log('Workflow status:', status)
      const db = new DatabaseService(env.DB)
      await db.updateCrateWorkflowId(crateId, workflowId)
    }
  },

  async fetch(request: Request, _env: Env): Promise<Response> {
    // Health check endpoint
    if (request.url.endsWith('/health')) {
      return new Response('OK')
    }

    return new Response('Not Found', { status: 404 })
  },
}
