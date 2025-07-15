import { DatabaseService } from '@riddick/database'
import { FixtureHelper } from '@riddick/fixtures'
import type { ItemInfo, QueueMessage } from '@riddick/types'
import { fetchMock, env, SELF } from 'cloudflare:test'
import { beforeAll, describe, it, expect, vi, inject } from 'vitest'

describe('crate-workflow', () => {
  const fixture = new FixtureHelper(inject('fixtureData'))

  beforeAll(() => {
    // Enable outbound request mocking...
    fetchMock.activate()
    // ...and throw errors if an outbound request isn't mocked
    fetchMock.disableNetConnect()
  })

  it('should process crates correctly', async () => {
    fetchMock
      .get('https://crates.io')
      .intercept({ path: () => true })
      .reply(200, fixture.mockDownloadCrate('rudy-parser', '0.4.0'))
    // mock the crate processing workflow
    env.RUST_PARSER.parse_rust_code = fixture.createMockRustParser(
      vi,
      'rudy-parser',
    )

    env.AI.run = vi
      .fn()
      .mockImplementation((_modelName, input: AiTextGenerationInput) => {
        const prompt = input.messages![input.messages!.length - 1].content
        const firstLine = prompt.split('\n')[0]

        return {
          response: `Mock AI response for ${firstLine}`,
        }
      })

    // we need to first create the crate in the database
    const dbService = new DatabaseService(env.DB)
    const createdCrate = await dbService.crates.createCrate({
      name: 'crate-one',
      version: '1.0.0',
    })

    // queue a crate for processing
    const message: ServiceBindingQueueMessage<QueueMessage> = {
      id: 'test-message-id',
      timestamp: new Date(),
      attempts: 1,
      body: {
        crateId: createdCrate.id,
        crateName: createdCrate.name,
        version: createdCrate.version,
        stage: 'fetch',
        created_at: new Date().toISOString(),
      },
    }

    // check it processed correctly
    const result = await SELF.queue('crate-processing', [message])

    expect(result.outcome).toBe('ok')
    expect(result.retryBatch.retry).toBe(false) // `true` if `batch.retryAll()` called
    expect(result.ackAll).toBe(false) // `true` if `batch.ackAll()` called
    expect(result.retryMessages).toStrictEqual([])

    // Verify the crate was created in the database
    const fetchedCrate = await dbService.crates.getCrate(createdCrate.id)
    expect(fetchedCrate).toBeDefined()
    expect(fetchedCrate!.name).toBe('crate-one')
    expect(fetchedCrate!.version).toBe('1.0.0')
    expect(fetchedCrate!.status).toBe('pending')

    await vi.waitUntil(async () => {
      const crate = await dbService.crates.getCrate(createdCrate.id)
      return crate?.status === 'complete'
    }, 10000)

    const completedCrate = await dbService.crates.getCrate(createdCrate.id)
    console.log('Completed crate:', completedCrate)
    expect(completedCrate).toBeDefined()
    expect(completedCrate!.status).toBe('complete')
    expect(completedCrate!.agent_summary).toContain(
      'Mock AI response for Analyze this Rust module and provide a concise summary:',
    )

    const prefix = `crates/${completedCrate!.name}/${completedCrate!.version}/`
    // check the items were created in R2
    const files = await env.CRATE_BUCKET.list({
      prefix,
    })
    const items = files.objects.map((file) => file.key.replace(prefix, ''))
    expect(items).toStrictEqual([
      'crate.json',
      'expressions.json',
      'expressions/parse_expression.json',
      'types.json',
      'types/parse_symbol.json',
      'types/parse_type.json',
    ])

    for (const file of files.objects) {
      const content = await env.CRATE_BUCKET.get(file.key)
      expect(content).toBeDefined()
      expect(content!.body).toBeDefined()
      console.log(`File: ${file.key}`)
      const info: ItemInfo = await content!.json()
      console.log('AI Summary:', info.agent_summary)
    }
  })
})
