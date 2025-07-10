import { describe, it, expect, beforeEach, vi } from 'vitest'

import { ModuleRepository } from './module-repository'

describe('ModuleRepository', () => {
  let repository: ModuleRepository
  let mockDb: D1Database

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn(),
    } as unknown as D1Database

    repository = new ModuleRepository(mockDb)
  })

  describe('createModule', () => {
    it('should create a module successfully', async () => {
      const mockModule = {
        id: 1,
        crate_id: 1,
        path: 'test::module',
        agent_summary: null,
      }

      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(mockModule),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.createModule({
        crate_id: 1,
        path: 'test::module',
      })

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'INSERT INTO modules (crate_id, path, agent_summary) VALUES (?, ?, ?) RETURNING *',
      )
      expect(mockPreparedStatement.bind).toHaveBeenCalledWith(
        1,
        'test::module',
        null,
      )
      expect(result).toEqual(mockModule)
    })

    it('should create a module with agent summary', async () => {
      const mockModule = {
        id: 1,
        crate_id: 1,
        path: 'test::module',
        agent_summary: 'Test module summary',
      }

      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(mockModule),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.createModule({
        crate_id: 1,
        path: 'test::module',
        agent_summary: 'Test module summary',
      })

      expect(mockPreparedStatement.bind).toHaveBeenCalledWith(
        1,
        'test::module',
        'Test module summary',
      )
      expect(result).toEqual(mockModule)
    })

    it('should throw error when creation fails', async () => {
      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      await expect(
        repository.createModule({
          crate_id: 1,
          path: 'test::module',
        }),
      ).rejects.toThrow('Failed to create module')
    })
  })

  describe('getModule', () => {
    it('should return a module by id', async () => {
      const mockModule = {
        id: 1,
        crate_id: 1,
        path: 'test::module',
        agent_summary: null,
      }

      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(mockModule),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.getModule(1)

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT * FROM modules WHERE id = ?',
      )
      expect(mockPreparedStatement.bind).toHaveBeenCalledWith(1)
      expect(result).toEqual(mockModule)
    })

    it('should return null when module not found', async () => {
      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.getModule(999)

      expect(result).toBeNull()
    })
  })

  describe('getModulesByCrate', () => {
    it('should return modules for a specific crate', async () => {
      const mockModules = [
        {
          id: 1,
          crate_id: 1,
          path: 'test::module1',
          agent_summary: null,
        },
        {
          id: 2,
          crate_id: 1,
          path: 'test::module2',
          agent_summary: 'Module 2 summary',
        },
      ]

      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: mockModules }),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.getModulesByCrate(1)

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT * FROM modules WHERE crate_id = ? ORDER BY path',
      )
      expect(mockPreparedStatement.bind).toHaveBeenCalledWith(1)
      expect(result).toEqual(mockModules)
    })
  })

  describe('getModuleByPath', () => {
    it('should return a module by crate_id and path', async () => {
      const mockModule = {
        id: 1,
        crate_id: 1,
        path: 'test::module',
        agent_summary: null,
      }

      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(mockModule),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.getModuleByPath(1, 'test::module')

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT * FROM modules WHERE crate_id = ? AND path = ?',
      )
      expect(mockPreparedStatement.bind).toHaveBeenCalledWith(1, 'test::module')
      expect(result).toEqual(mockModule)
    })
  })

  describe('updateModuleSummary', () => {
    it('should update module summary successfully', async () => {
      const mockResult = {
        success: true,
        meta: { changes: 1 },
        error: null,
      }

      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue(mockResult),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      await repository.updateModuleSummary({
        id: 1,
        summary: 'Updated summary',
      })

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'UPDATE modules SET agent_summary = ? WHERE id = ?',
      )
      expect(mockPreparedStatement.bind).toHaveBeenCalledWith(
        'Updated summary',
        1,
      )
    })

    it('should throw error when update fails', async () => {
      const mockResult = {
        success: false,
        meta: { changes: 0 },
        error: 'Database error',
      }

      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue(mockResult),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      await expect(
        repository.updateModuleSummary({
          id: 1,
          summary: 'Updated summary',
        }),
      ).rejects.toThrow('Failed to update module summary: Database error')
    })

    it('should throw error when module not found', async () => {
      const mockResult = {
        success: true,
        meta: { changes: 0 },
        error: null,
      }

      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue(mockResult),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      await expect(
        repository.updateModuleSummary({
          id: 999,
          summary: 'Updated summary',
        }),
      ).rejects.toThrow('Module with id 999 not found')
    })
  })

  describe('batchCreateModules', () => {
    it('should create multiple modules successfully', async () => {
      const mockModules = [
        {
          id: 1,
          crate_id: 1,
          path: 'test::module1',
          agent_summary: null,
        },
        {
          id: 2,
          crate_id: 1,
          path: 'test::module2',
          agent_summary: 'Module 2 summary',
        },
      ]

      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        first: vi
          .fn()
          .mockResolvedValueOnce(mockModules[0])
          .mockResolvedValueOnce(mockModules[1]),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.batchCreateModules([
        {
          crate_id: 1,
          path: 'test::module1',
        },
        {
          crate_id: 1,
          path: 'test::module2',
          agent_summary: 'Module 2 summary',
        },
      ])

      expect(mockDb.prepare).toHaveBeenCalledTimes(2)
      expect(result).toEqual(mockModules)
    })
  })

  describe('getModuleCount', () => {
    it('should return total count of modules', async () => {
      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ count: 10 }),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.getModuleCount()

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM modules',
      )
      expect(result).toBe(10)
    })

    it('should return count of modules for specific crate', async () => {
      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ count: 5 }),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.getModuleCount(1)

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM modules WHERE crate_id = ?',
      )
      expect(mockPreparedStatement.bind).toHaveBeenCalledWith(1)
      expect(result).toBe(5)
    })
  })

  describe('searchModulesByPath', () => {
    it('should search modules by path pattern', async () => {
      const mockModules = [
        {
          id: 1,
          crate_id: 1,
          path: 'tokio::time',
          agent_summary: null,
        },
        {
          id: 2,
          crate_id: 1,
          path: 'tokio::time::delay',
          agent_summary: null,
        },
      ]

      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: mockModules }),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.searchModulesByPath('time')

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT * FROM modules WHERE path LIKE ? ORDER BY path',
      )
      expect(mockPreparedStatement.bind).toHaveBeenCalledWith('%time%')
      expect(result).toEqual(mockModules)
    })
  })
})
