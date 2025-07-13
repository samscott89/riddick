import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fixtures, FixtureHelper } from '@riddick/fixtures'
import { CrateProcessingWorkflow } from '../src/index'
import { CrateStatus } from '@riddick/types'

// Mock the DatabaseService
const mockDb = {
  updateCrateProgress: vi.fn(),
  updateCrateWorkflowId: vi.fn(),
  modules: {
    createModule: vi.fn().mockResolvedValue({ id: 1 }),
  },
  items: {
    createItem: vi.fn(),
  },
  getCrateWithModulesAndItems: vi.fn().mockResolvedValue({
    crate: { id: 1, name: 'test-crate' },
    modules: [{ id: 1, path: 'src/lib.rs' }],
    items: [{ id: 1, module_id: 1, name: 'test_function', item_type: 'function' }],
  }),
}

vi.mock('@riddick/database', () => ({
  DatabaseService: vi.fn().mockImplementation(() => mockDb),
}))

// Mock external dependencies
const mockEnv = {
  DB: {} as D1Database,
  CRATE_BUCKET: {
    get: vi.fn(),
    put: vi.fn(),
  } as unknown as R2Bucket,
  RUST_PARSER: FixtureHelper.createMockRustParser(),
  AI: {
    run: vi.fn().mockResolvedValue({ response: 'AI summary' }),
  } as unknown as Ai,
} as any

// Mock global fetch
global.fetch = vi.fn()

describe('CrateProcessingWorkflow', () => {
  let workflow: CrateProcessingWorkflow
  let mockStep: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    workflow = new CrateProcessingWorkflow()
    // @ts-ignore - accessing private property for testing
    workflow.env = mockEnv
    
    // Mock WorkflowStep
    mockStep = {
      do: vi.fn().mockImplementation(async (name: string, fn: () => Promise<any>) => {
        return await fn()
      }),
    }
  })

  describe('fetchCrateData', () => {
    it('should download crate from crates.io when not in R2', async () => {
      // Mock R2 bucket - no existing crate
      mockEnv.CRATE_BUCKET.get.mockResolvedValue(null)
      
      // Mock successful download from crates.io
      const mockTarballData = fixtures.rudyParser.tarball()
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(mockTarballData.buffer),
      })

      const result = await (workflow as any).fetchCrateData('rudy-parser', '0.4.0')

      expect(global.fetch).toHaveBeenCalledWith(
        'https://crates.io/api/v1/crates/rudy-parser/0.4.0/download'
      )
      expect(mockEnv.CRATE_BUCKET.put).toHaveBeenCalledWith(
        'rudy-parser-0.4.0.tar.gz',
        mockTarballData.buffer
      )
      expect(result.name).toBe('rudy-parser')
      expect(result.version).toBe('0.4.0')
      expect(result.files).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: expect.stringContaining('.rs'),
            content: expect.any(String),
          }),
        ])
      )
    })

    it('should use existing crate from R2 when available', async () => {
      const mockTarballData = fixtures.rudyParser.tarball()
      
      // Mock R2 bucket - existing crate
      mockEnv.CRATE_BUCKET.get.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(mockTarballData.buffer),
      })

      const result = await (workflow as any).fetchCrateData('rudy-parser', '0.4.0')

      expect(global.fetch).not.toHaveBeenCalled()
      expect(result.name).toBe('rudy-parser')
      expect(result.version).toBe('0.4.0')
    })

    it('should throw NonRetryableError for 404 responses', async () => {
      mockEnv.CRATE_BUCKET.get.mockResolvedValue(null)
      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
      })

      await expect(
        (workflow as any).fetchCrateData('nonexistent-crate', '1.0.0')
      ).rejects.toThrow('Crate nonexistent-crate v1.0.0 not found on crates.io')
    })
  })

  describe('parseRustFiles', () => {
    it('should parse all rust files successfully', async () => {
      const files = [
        { path: 'src/lib.rs', content: 'pub mod expressions;' },
        { path: 'src/expressions.rs', content: 'pub struct Expression;' },
      ]

      const result = await (workflow as any).parseRustFiles(files)

      expect(result).toHaveLength(2)
      expect(mockEnv.RUST_PARSER.parse_rust_code).toHaveBeenCalledTimes(2)
      expect(result[0]).toEqual({
        path: 'src/lib.rs',
        content: 'pub mod expressions;',
        parsed: expect.any(Object),
      })
    })

    it('should throw NonRetryableError when parsing fails', async () => {
      const files = [{ path: 'src/bad.rs', content: 'invalid rust code' }]
      
      mockEnv.RUST_PARSER.parse_rust_code.mockReturnValue({
        success: false,
        errors: ['Syntax error'],
      })

      await expect((workflow as any).parseRustFiles(files)).rejects.toThrow(
        'Failed to parse file src/bad.rs'
      )
    })
  })

  describe('storeParsedData', () => {
    it('should store modules and items in database', async () => {
      const parsedFiles = [
        {
          path: 'src/lib.rs',
          content: 'pub fn test() {}',
          parsed: {
            items: [
              {
                name: 'test',
                item_type: 'function',
              },
            ],
          },
        },
      ]

      await (workflow as any).storeParsedData(123, parsedFiles)

      expect(mockDb.modules.createModule).toHaveBeenCalledWith({
        crate_id: 123,
        path: 'src/lib.rs',
        agent_summary: undefined,
      })

      expect(mockDb.items.createItem).toHaveBeenCalledWith({
        module_id: 1,
        name: 'test',
        item_type: 'function',
        source_code: 'pub fn test() {}',
        agent_summary: undefined,
      })
    })
  })

  describe('full workflow integration', () => {
    it('should complete full workflow successfully', async () => {
      // Setup mocks for successful workflow
      mockEnv.CRATE_BUCKET.get.mockResolvedValue(null)
      const mockTarballData = fixtures.rudyParser.tarball()
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(mockTarballData.buffer),
      })

      const mockEvent = {
        payload: {
          crateId: 123,
          crateName: 'rudy-parser',
          version: '0.4.0',
        },
      }

      await workflow.run(mockEvent, mockStep)

      // Verify status updates
      expect(mockDb.updateCrateProgress).toHaveBeenCalledWith(123, CrateStatus.PARSING)
      expect(mockDb.updateCrateProgress).toHaveBeenCalledWith(123, CrateStatus.COMPLETE)
      
      // Verify all workflow steps were executed
      expect(mockStep.do).toHaveBeenCalledWith('update-status-processing', expect.any(Function))
      expect(mockStep.do).toHaveBeenCalledWith('fetch-crate-data', expect.any(Function))
      expect(mockStep.do).toHaveBeenCalledWith('parse-rust-files', expect.any(Function))
      expect(mockStep.do).toHaveBeenCalledWith('store-parsed-data', expect.any(Function))
      expect(mockStep.do).toHaveBeenCalledWith('generate-summaries', expect.any(Function))
      expect(mockStep.do).toHaveBeenCalledWith('update-status-completed', expect.any(Function))
    })

    it('should handle workflow failures gracefully', async () => {
      // Setup failure scenario
      mockEnv.CRATE_BUCKET.get.mockResolvedValue(null)
      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
      })

      const mockEvent = {
        payload: {
          crateId: 123,
          crateName: 'nonexistent-crate',
          version: '1.0.0',
        },
      }

      await expect(workflow.run(mockEvent, mockStep)).rejects.toThrow()

      // Verify failure status was set
      expect(mockDb.updateCrateProgress).toHaveBeenCalledWith(
        123,
        CrateStatus.FAILED,
        expect.any(String)
      )
    })
  })
})