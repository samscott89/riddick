import { describe, it, expect, beforeEach, vi } from 'vitest'

import { CrateStatus } from '@riddick/types'

import { CrateRepository } from './crate-repository'

describe('CrateRepository', () => {
  let repository: CrateRepository
  let mockDb: D1Database

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn(),
    } as unknown as D1Database

    repository = new CrateRepository(mockDb)
  })

  describe('createCrate', () => {
    it('should create a crate with default status', async () => {
      const mockCrate = {
        id: 1,
        name: 'test-crate',
        version: '1.0.0',
        agent_summary: null,
        status: CrateStatus.PENDING,
        error_message: null,
        created_at: '2023-01-01T00:00:00Z',
      }

      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(mockCrate),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.createCrate({
        name: 'test-crate',
        version: '1.0.0',
      })

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'INSERT INTO crates (name, version, agent_summary, status) VALUES (?, ?, ?, ?) RETURNING *',
      )
      expect(mockPreparedStatement.bind).toHaveBeenCalledWith(
        'test-crate',
        '1.0.0',
        null,
        CrateStatus.PENDING,
      )
      expect(result).toEqual(mockCrate)
    })

    it('should create a crate with custom status and summary', async () => {
      const mockCrate = {
        id: 1,
        name: 'test-crate',
        version: '1.0.0',
        agent_summary: 'Test summary',
        status: CrateStatus.COMPLETE,
        error_message: null,
        created_at: '2023-01-01T00:00:00Z',
      }

      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(mockCrate),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.createCrate({
        name: 'test-crate',
        version: '1.0.0',
        agent_summary: 'Test summary',
        status: CrateStatus.COMPLETE,
      })

      expect(mockPreparedStatement.bind).toHaveBeenCalledWith(
        'test-crate',
        '1.0.0',
        'Test summary',
        CrateStatus.COMPLETE,
      )
      expect(result).toEqual(mockCrate)
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
        repository.createCrate({
          name: 'test-crate',
          version: '1.0.0',
        }),
      ).rejects.toThrow('Failed to create crate')
    })
  })

  describe('getCrate', () => {
    it('should return a crate by id', async () => {
      const mockCrate = {
        id: 1,
        name: 'test-crate',
        version: '1.0.0',
        agent_summary: null,
        status: CrateStatus.PENDING,
        error_message: null,
        created_at: '2023-01-01T00:00:00Z',
      }

      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(mockCrate),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.getCrate(1)

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT * FROM crates WHERE id = ?',
      )
      expect(mockPreparedStatement.bind).toHaveBeenCalledWith(1)
      expect(result).toEqual(mockCrate)
    })

    it('should return null when crate not found', async () => {
      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.getCrate(999)

      expect(result).toBeNull()
    })
  })

  describe('getCrateByNameVersion', () => {
    it('should return a crate by name and version', async () => {
      const mockCrate = {
        id: 1,
        name: 'test-crate',
        version: '1.0.0',
        agent_summary: null,
        status: CrateStatus.PENDING,
        error_message: null,
        created_at: '2023-01-01T00:00:00Z',
      }

      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(mockCrate),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.getCrateByNameVersion(
        'test-crate',
        '1.0.0',
      )

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT * FROM crates WHERE name = ? AND version = ?',
      )
      expect(mockPreparedStatement.bind).toHaveBeenCalledWith(
        'test-crate',
        '1.0.0',
      )
      expect(result).toEqual(mockCrate)
    })
  })

  describe('updateCrateStatus', () => {
    it('should update crate status successfully', async () => {
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

      await repository.updateCrateStatus({
        id: 1,
        status: CrateStatus.COMPLETE,
      })

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'UPDATE crates SET status = ?, error_message = ? WHERE id = ?',
      )
      expect(mockPreparedStatement.bind).toHaveBeenCalledWith(
        CrateStatus.COMPLETE,
        null,
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
        repository.updateCrateStatus({
          id: 1,
          status: CrateStatus.COMPLETE,
        }),
      ).rejects.toThrow('Failed to update crate status: Database error')
    })

    it('should throw error when crate not found', async () => {
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
        repository.updateCrateStatus({
          id: 999,
          status: CrateStatus.COMPLETE,
        }),
      ).rejects.toThrow('Crate with id 999 not found')
    })
  })

  describe('listCrates', () => {
    it('should return list of crates with default pagination', async () => {
      const mockCrates = [
        {
          id: 1,
          name: 'crate-1',
          version: '1.0.0',
          agent_summary: null,
          status: CrateStatus.PENDING,
          error_message: null,
          created_at: '2023-01-01T00:00:00Z',
        },
        {
          id: 2,
          name: 'crate-2',
          version: '1.0.0',
          agent_summary: null,
          status: CrateStatus.COMPLETE,
          error_message: null,
          created_at: '2023-01-01T01:00:00Z',
        },
      ]

      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: mockCrates }),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.listCrates()

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT * FROM crates ORDER BY created_at DESC LIMIT ? OFFSET ?',
      )
      expect(mockPreparedStatement.bind).toHaveBeenCalledWith(50, 0)
      expect(result).toEqual(mockCrates)
    })

    it('should return list of crates with custom pagination', async () => {
      const mockCrates: unknown[] = []

      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: mockCrates }),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.listCrates(10, 20)

      expect(mockPreparedStatement.bind).toHaveBeenCalledWith(10, 20)
      expect(result).toEqual(mockCrates)
    })
  })

  describe('getCratesByStatus', () => {
    it('should return crates filtered by status', async () => {
      const mockCrates = [
        {
          id: 1,
          name: 'crate-1',
          version: '1.0.0',
          agent_summary: null,
          status: CrateStatus.FAILED,
          error_message: 'Test error',
          created_at: '2023-01-01T00:00:00Z',
        },
      ]

      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: mockCrates }),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.getCratesByStatus(CrateStatus.FAILED)

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT * FROM crates WHERE status = ? ORDER BY created_at DESC',
      )
      expect(mockPreparedStatement.bind).toHaveBeenCalledWith(
        CrateStatus.FAILED,
      )
      expect(result).toEqual(mockCrates)
    })
  })

  describe('getCrateCount', () => {
    it('should return total count of crates', async () => {
      const mockPreparedStatement = {
        first: vi.fn().mockResolvedValue({ count: 42 }),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.getCrateCount()

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM crates',
      )
      expect(result).toBe(42)
    })

    it('should return 0 when no result', async () => {
      const mockPreparedStatement = {
        first: vi.fn().mockResolvedValue(null),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.getCrateCount()

      expect(result).toBe(0)
    })
  })
})
