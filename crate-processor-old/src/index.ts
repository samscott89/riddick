import { CrateRepository } from '../../lib/repositories/crate-repository'
import { ItemRepository } from '../../lib/repositories/item-repository'
import { ModuleRepository } from '../../lib/repositories/module-repository'
import type { QueueMessage } from '../../lib/types';
import { CrateStatus } from '../../lib/types'

import { parseRustCode } from './parser'

type Bindings = {
  DB: D1Database
  CRATE_QUEUE: Queue
  PARSE_QUEUE: Queue
  CRATES_STORAGE: R2Bucket
  CRATES_API_BASE_URL: string
}

// Queue consumer for processing crate tasks
async function queue(batch: MessageBatch<QueueMessage>, env: Bindings): Promise<void> {
  const crateRepo = new CrateRepository(env.DB)
  const moduleRepo = new ModuleRepository(env.DB)
  const itemRepo = new ItemRepository(env.DB)

  for (const message of batch.messages) {
    const { crate_id, crate_name, version, stage } = message.body
    
    try {
      console.log(`Processing crate ${crate_name}:${version} (${crate_id}) - stage: ${stage}`)
      
      switch (stage) {
        case 'fetch':
          await processFetchStage(crate_id, crate_name, version, env, crateRepo)
          break
        case 'parse':
          await processParseStage(crate_id, crate_name, version, env, crateRepo, moduleRepo, itemRepo)
          break
        case 'summarize':
          await processSummarizeStage(crate_id, crate_name, version, env, crateRepo)
          break
        default:
          console.error(`Unknown stage: ${stage as string}`)
      }
    } catch (error) {
      console.error(`Error processing crate ${crate_name}:${version}:`, error)
      
      // Update status to failed
      await crateRepo.updateCrateStatus({
        id: crate_id,
        status: CrateStatus.FAILED,
        error_message: String(error),
      })
      
      throw error // Re-throw to trigger retry mechanism
    }
  }
}

async function processFetchStage(
  crateId: number, 
  crateName: string, 
  version: string, 
  env: Bindings,
  crateRepo: CrateRepository
): Promise<void> {
  // Update status to fetching
  await crateRepo.updateCrateStatus({
    id: crateId,
    status: CrateStatus.FETCHING,
  })
  
  // Check R2 cache first, then download if needed
  const cacheKey = `${crateName}/${version}.tar.gz`
  let tarballBuffer: ArrayBuffer
  
  try {
    // Try to get from R2 cache first
    const cachedObject = await env.CRATES_STORAGE.get(cacheKey)
    
    if (cachedObject) {
      console.log(`Cache hit for ${crateName}:${version}`)
      tarballBuffer = await cachedObject.arrayBuffer()
    } else {
      console.log(`Cache miss for ${crateName}:${version}, downloading...`)
      
      // Download from crates.io
      const downloadUrl = `${env.CRATES_API_BASE_URL}/crates/${crateName}/${version}/download`
      const response = await fetch(downloadUrl)
      
      if (!response.ok) {
        if (response.status === 404) {
          await crateRepo.updateCrateStatus({
            id: crateId,
            status: CrateStatus.NOT_FOUND,
            error_message: 'Crate not found on crates.io',
          })
          return
        }
        throw new Error(`Failed to fetch crate: ${response.status}`)
      }
      
      tarballBuffer = await response.arrayBuffer()
      
      // Store in R2 cache for future use
      await env.CRATES_STORAGE.put(cacheKey, tarballBuffer, {
        httpMetadata: {
          contentType: 'application/gzip',
        },
      })
      console.log(`Cached ${crateName}:${version} in R2`)
    }
  } catch (error) {
    console.error(`Error fetching/caching crate ${crateName}:${version}:`, error)
    throw error
  }
  
  // TODO: Extract and store the tarball data properly
  // For now, we'll just mark as fetched and move to parse
  await crateRepo.updateCrateStatus({
    id: crateId,
    status: CrateStatus.FETCHED,
  })
  
  // Queue the next stage
  const queueMessage: QueueMessage = {
    crate_id: crateId,
    crate_name: crateName,
    version,
    stage: 'parse',
    created_at: new Date().toISOString(),
  }
  
  await env.CRATE_QUEUE.send(queueMessage)
}

async function processParseStage(
  crateId: number, 
  crateName: string, 
  version: string, 
  env: Bindings,
  crateRepo: CrateRepository,
  moduleRepo: ModuleRepository,
  itemRepo: ItemRepository
): Promise<void> {
  // Update status to parsing
  await crateRepo.updateCrateStatus({
    id: crateId,
    status: CrateStatus.PARSING,
  })
  
  try {
    // TODO: Implement actual tarball extraction and parsing
    // For now, we'll create dummy data to test the workflow
    
    // Create a lib module
    const libModule = await moduleRepo.createModule({
      crate_id: crateId,
      path: 'src/lib.rs',
    })
    
    // Create a dummy function item
    const dummyCode = `pub fn example_function() -> String {
    "Hello from ${crateName}".to_string()
}`
    
    // Parse the dummy code with the existing parser
    const parseResult = await parseRustCode(dummyCode)
    
    if (parseResult.success && parseResult.crateInfo) {
      // Store the parsed items
      for (const item of parseResult.crateInfo.rootModule.items) {
        await itemRepo.createItem({
          module_id: libModule.id,
          name: item.name,
          item_type: item.type,
          source_code: dummyCode,
        })
      }
    }
    
    // Update status to parsed
    await crateRepo.updateCrateStatus({
      id: crateId,
      status: CrateStatus.PARSED,
    })
    
    // Queue the next stage
    const queueMessage: QueueMessage = {
      crate_id: crateId,
      crate_name: crateName,
      version,
      stage: 'summarize',
      created_at: new Date().toISOString(),
    }
    
    await env.CRATE_QUEUE.send(queueMessage)
    
  } catch (error) {
    console.error('Parse error:', error)
    throw error
  }
}

async function processSummarizeStage(
  crateId: number, 
  crateName: string, 
  version: string, 
  _env: Bindings,
  crateRepo: CrateRepository
): Promise<void> {
  // Update status to summarizing
  await crateRepo.updateCrateStatus({
    id: crateId,
    status: CrateStatus.SUMMARIZING,
  })
  
  // TODO: Implement AI summarization workflow
  // For now, we'll just create a simple summary
  const summary = `${crateName} version ${version} - A Rust crate with basic functionality.`
  
  await crateRepo.updateCrateSummary(crateId, summary)
  
  // Update status to complete
  await crateRepo.updateCrateStatus({
    id: crateId,
    status: CrateStatus.COMPLETE,
  })
  
  console.log(`Crate ${crateName}:${version} processing complete`)
}

// Default export that includes queue handler
export default {
  fetch(): Response {
    return new Response('Crate processor worker - queue consumer only', { status: 200 })
  },
  queue,
}

