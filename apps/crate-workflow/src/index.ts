import {
  WorkflowEntrypoint,
  type WorkflowStep,
  type WorkflowEvent,
} from 'cloudflare:workers'
import { DatabaseService } from '@riddick/database'
import type { ItemInfo } from '@riddick/types'
import {
  CrateStatus,
  type QueueMessage,
  type CrateWithData,
  type ParseResponse,
} from '@riddick/types'
import { TarExtractor } from './extractor'
import { NonRetryableError } from 'cloudflare:workflows'

interface RustParser extends Fetcher {
  parse_rust_code(input: {
    code: string
    filePath?: string | null
    includePrivate?: boolean
  }): Promise<ParseResponse>
}

export interface Env {
  DB: D1Database
  CRATE_BUCKET: R2Bucket
  RUST_PARSER: RustParser
  CRATE_WORKFLOW: Workflow
  AI: Ai
}

export interface CrateProcessingParams {
  crateId: number
  crateName: string
  version: string
}

export interface CrateAiSummary {
  crateSummary: string
  moduleSummaries: Map<string, string>
}

export class CrateProcessor {
  constructor(private env: Env) {}

  async fetchCrateData(
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

  async extractRustFiles(
    tarballData: Uint8Array,
  ): Promise<Map<string, string>> {
    return await TarExtractor.extractRustFiles(tarballData)
  }

  async recursivelyParseAndStore(
    crateId: number,
    crateName: string,
    version: string,
    files: Map<string, string>,
  ): Promise<string[]> {
    const processedModules = new Set<string>()
    const storedKeys: string[] = []

    // Start with lib.rs or main.rs as entrypoint
    const entrypoint = 'src/lib.rs'
    const file = files.get(entrypoint)

    if (!file) {
      throw new NonRetryableError(
        `No entrypoint found (${entrypoint}) for crate ${crateName}`,
      )
    }

    console.log(`Starting recursive parsing from entrypoint: ${entrypoint}`)

    const modulePath: string[] = []

    const keys = await this.parseAndStoreFile(
      crateId,
      crateName,
      version,
      modulePath,
      { path: entrypoint, content: file },
      files,
      processedModules,
    )

    storedKeys.push(...keys)
    return storedKeys
  }

  private async parseAndStoreFile(
    crateId: number,
    crateName: string,
    version: string,
    modulePath: string[],
    file: { path: string; content: string },
    allFiles: Map<string, string>,
    processedModules: Set<string>,
  ): Promise<string[]> {
    async function storeItem(
      itemKey: string,
      item: ItemInfo,
      bucket: R2Bucket,
    ) {
      try {
        await bucket.put(itemKey, JSON.stringify(item))
        console.log(`Stored item: ${item.name} at ${itemKey}`)
      } catch (error) {
        console.error(`Failed to store item ${item.name}:`, error)
      }
    }

    const storedKeys: string[] = []

    const currentPath = ['src', ...modulePath].join('/')

    // Mark this file as processed to prevent infinite loops
    if (processedModules.has(file.path)) {
      return storedKeys
    }
    processedModules.add(file.path)

    console.log(`Parsing file: ${file.path} in module ${modulePath.join('.')}`)
    console.log(file.content.substring(0, 100) + '...') // Log first 100 chars

    // Parse the file using the Rust parser
    const response = await this.env.RUST_PARSER.parse_rust_code({
      code: file.content,
      filePath: file.path,
      includePrivate: false, // Only process public items for recursive parsing
    })

    if (!response.success || !response.fileInfo) {
      console.warn(
        `Failed to parse file ${file.path}: ${response.errors.join(', ')}`,
      )
      return storedKeys
    }

    // save the module summary
    let itemKey
    if (modulePath.length === 0) {
      // this is the root module
      itemKey = `crates/${crateName}/${version}/crate.json`
    } else {
      itemKey = `crates/${crateName}/${version}/${modulePath.join('/')}.json`
    }
    try {
      await this.env.CRATE_BUCKET.put(
        itemKey,
        JSON.stringify(response.fileInfo),
      )
    } catch (error) {
      throw new Error(`Failed to store module info at ${itemKey}: ${error}`)
    }

    const { items, moduleReferences } = response.fileInfo

    // Store each item as a separate JSON file in R2
    for (const item of items) {
      const itemType = this.getItemType(item)

      const itemKey = `crates/${crateName}/${version}/${modulePath.join('/')}/${item.name}.json`
      switch (itemType) {
        case 'function':
          await storeItem(itemKey, item, this.env.CRATE_BUCKET)
          storedKeys.push(itemKey)

          break
        case 'adt':
          await storeItem(itemKey, item, this.env.CRATE_BUCKET)
          storedKeys.push(itemKey)

          break
        case 'trait':
          await storeItem(itemKey, item, this.env.CRATE_BUCKET)
          storedKeys.push(itemKey)
          break
        default:
          break
      }
    }

    // Recursively process module references
    for (const moduleRef of moduleReferences) {
      if (moduleRef.visibility.includes('pub')) {
        const newModulePath: string[] = [...modulePath, moduleRef.name]
        // Find the referenced module file
        const moduleFile = moduleRef.expectedPaths.find((path) => {
          const filePath = `${currentPath}/${path}`
          return allFiles.has(filePath)
        })
        if (!moduleFile) {
          console.warn(
            `Module reference ${moduleRef.name} not found in provided files`,
          )
          continue
        }
        const path = `${currentPath}/${moduleFile}`
        const content = allFiles.get(path)!

        const recursiveKeys = await this.parseAndStoreFile(
          crateId,
          crateName,
          version,
          newModulePath,
          { path, content },
          allFiles,
          processedModules,
        )
        storedKeys.push(...recursiveKeys)
      }
    }

    return storedKeys
  }

  private getItemType(item: any): string {
    if ('function' in item.details) return 'function'
    if ('adt' in item.details) return item.details.adt.adtType
    if ('trait' in item.details) return 'trait'
    if ('module' in item.details) return 'module'
    if ('other' in item.details) return item.details.other.itemType
    return 'unknown'
  }

  async generateSummaries(crateId: number): Promise<CrateAiSummary> {
    const db = new DatabaseService(this.env.DB)
    const moduleSummaries = new Map<string, string>()

    // Get crate data from database
    const crate = await db.crates.getCrate(crateId)
    if (!crate)
      throw new NonRetryableError(`Crate with ID ${crateId} not found`)

    // List all items stored in R2 for this crate
    const prefix = `crates/${crate.name}/${crate.version}/`
    const listed = await this.env.CRATE_BUCKET.list({ prefix })

    // Group items by module (file path)
    const itemsByModule = new Map<string, any[]>()

    for (const object of listed.objects) {
      // Parse the path to extract module and item name
      const pathParts = object.key.replace(prefix, '').split('/')
      if (pathParts.length >= 2) {
        const modulePath = pathParts.slice(0, -1).join('/')

        // Get the item content
        const itemObj = await this.env.CRATE_BUCKET.get(object.key)
        if (itemObj) {
          const itemData = JSON.parse(await itemObj.text())

          if (!itemsByModule.has(modulePath)) {
            itemsByModule.set(modulePath, [])
          }
          itemsByModule.get(modulePath)!.push(itemData)
        }
      }
    }

    // Generate crate-level summary
    const moduleList = Array.from(itemsByModule.keys())
    const crateContext = moduleList.map((m) => `Module: ${m}`).join('\n')

    const crateSummary = await this.generateAISummary(
      `Summarize this Rust crate "${crate.name}" based on its modules:

${crateContext}

Provide a concise summary of what this crate does, its main purpose, and key functionality.`,
    )

    // Generate module summaries
    for (const [modulePath, items] of itemsByModule) {
      const itemsContext = items
        .map((item) => {
          const itemType = this.getItemType(item)
          return `${itemType}: ${item.name}`
        })
        .join('\n')

      if (itemsContext) {
        const moduleSummary = await this.generateAISummary(
          `Summarize this Rust module "${modulePath}" based on its contents:

${itemsContext}

Explain what this module does and its role in the crate.`,
        )

        moduleSummaries.set(modulePath, moduleSummary)
      }
    }

    console.log(
      `Generated summaries for crate ${crateId} with ${moduleList.length} modules`,
    )

    return { crateSummary, moduleSummaries }
  }

  async generateAISummary(prompt: string): Promise<string> {
    try {
      const { response } = await this.env.AI.run(
        '@cf/meta/llama-3.1-8b-instruct',
        {
          messages: [
            {
              role: 'system',
              content:
                'You are a helpful assistant that explains Rust code. Be concise and technical.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: 200,
        },
      )

      return response || 'AI summary unavailable'
    } catch (error) {
      console.warn('AI summary generation failed:', error)
      return 'AI summary unavailable'
    }
  }

  async storeCompletedCrate(
    crateId: number,
    crateSummary: string,
    moduleSummaries: Map<string, string>,
  ): Promise<void> {
    const db = new DatabaseService(this.env.DB)

    // Store crate summary in database
    await db.crates.updateCrateSummary(crateId, crateSummary)

    // Store module summaries in R2
    const summariesKey = `parsed-crates/${crateId}/summaries.json`
    const summariesData = {
      crateId,
      crateSummary,
      moduleSummaries: Object.fromEntries(moduleSummaries),
      generatedAt: new Date().toISOString(),
    }

    await this.env.CRATE_BUCKET.put(
      summariesKey,
      JSON.stringify(summariesData, null, 2),
      {
        customMetadata: {
          crateId: crateId.toString(),
          moduleCount: moduleSummaries.size.toString(),
        },
      },
    )

    // Update crate status to COMPLETED
    await db.updateCrateProgress(crateId, CrateStatus.COMPLETE)

    console.log(`Crate ${crateId} processing completed successfully`)
  }
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
      await db.updateCrateProgress(crateId, CrateStatus.PROCESSING)
    })

    let crateData: CrateWithData
    const crateProcessor = new CrateProcessor(this.env)

    try {
      // Phase 1: Fetch and recursively parse all items
      crateData = await step.do('fetch-crate-data', async () => {
        return await crateProcessor.fetchCrateData(crateName, version)
      })

      const storedKeys = await step.do(
        'recursive-parse-and-store',
        async () => {
          return await crateProcessor.recursivelyParseAndStore(
            crateId,
            crateName,
            version,
            crateData.files,
          )
        },
      )

      console.log(`Phase 1 completed: stored ${storedKeys.length} items in R2`)

      // Phase 2: AI enrichment (generate summaries)
      const summary = await step.do('generate-summaries', async () => {
        return await crateProcessor.generateSummaries(crateId)
      })

      await step.do('update-status-completed', async () => {
        return await crateProcessor.storeCompletedCrate(
          crateId,
          summary.crateSummary,
          summary.moduleSummaries,
        )
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
