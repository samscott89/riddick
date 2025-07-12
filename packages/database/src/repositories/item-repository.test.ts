import { describe, it, expect, beforeEach, vi } from 'vitest'

import { ItemType } from '@riddick/types'

import { ItemRepository } from './item-repository'

describe('ItemRepository', () => {
  let repository: ItemRepository
  let mockDb: D1Database

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn(),
    } as unknown as D1Database

    repository = new ItemRepository(mockDb)
  })

  describe('createItem', () => {
    it('should create an item successfully', async () => {
      const mockItem = {
        id: 1,
        module_id: 1,
        name: 'test_function',
        item_type: ItemType.FUNCTION,
        source_code: 'fn test_function() {}',
        agent_summary: null,
      }

      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(mockItem),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.createItem({
        module_id: 1,
        name: 'test_function',
        item_type: ItemType.FUNCTION,
        source_code: 'fn test_function() {}',
      })

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'INSERT INTO items (module_id, name, item_type, source_code, agent_summary) VALUES (?, ?, ?, ?, ?) RETURNING *',
      )
      expect(mockPreparedStatement.bind).toHaveBeenCalledWith(
        1,
        'test_function',
        ItemType.FUNCTION,
        'fn test_function() {}',
        null,
      )
      expect(result).toEqual(mockItem)
    })

    it('should create an item with agent summary', async () => {
      const mockItem = {
        id: 1,
        module_id: 1,
        name: 'TestStruct',
        item_type: ItemType.STRUCT,
        source_code: 'struct TestStruct {}',
        agent_summary: 'A test struct',
      }

      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(mockItem),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.createItem({
        module_id: 1,
        name: 'TestStruct',
        item_type: ItemType.STRUCT,
        source_code: 'struct TestStruct {}',
        agent_summary: 'A test struct',
      })

      expect(mockPreparedStatement.bind).toHaveBeenCalledWith(
        1,
        'TestStruct',
        ItemType.STRUCT,
        'struct TestStruct {}',
        'A test struct',
      )
      expect(result).toEqual(mockItem)
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
        repository.createItem({
          module_id: 1,
          name: 'test_function',
          item_type: ItemType.FUNCTION,
          source_code: 'fn test_function() {}',
        }),
      ).rejects.toThrow('Failed to create item')
    })
  })

  describe('getItem', () => {
    it('should return an item by id', async () => {
      const mockItem = {
        id: 1,
        module_id: 1,
        name: 'test_function',
        item_type: ItemType.FUNCTION,
        source_code: 'fn test_function() {}',
        agent_summary: null,
      }

      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(mockItem),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.getItem(1)

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT * FROM items WHERE id = ?',
      )
      expect(mockPreparedStatement.bind).toHaveBeenCalledWith(1)
      expect(result).toEqual(mockItem)
    })

    it('should return null when item not found', async () => {
      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.getItem(999)

      expect(result).toBeNull()
    })
  })

  describe('getItemsByModule', () => {
    it('should return items for a specific module', async () => {
      const mockItems = [
        {
          id: 1,
          module_id: 1,
          name: 'test_function',
          item_type: ItemType.FUNCTION,
          source_code: 'fn test_function() {}',
          agent_summary: null,
        },
        {
          id: 2,
          module_id: 1,
          name: 'TestStruct',
          item_type: ItemType.STRUCT,
          source_code: 'struct TestStruct {}',
          agent_summary: 'A test struct',
        },
      ]

      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: mockItems }),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.getItemsByModule(1)

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT * FROM items WHERE module_id = ? ORDER BY name',
      )
      expect(mockPreparedStatement.bind).toHaveBeenCalledWith(1)
      expect(result).toEqual(mockItems)
    })
  })

  describe('getItemsByType', () => {
    it('should return items filtered by type', async () => {
      const mockItems = [
        {
          id: 1,
          module_id: 1,
          name: 'test_function',
          item_type: ItemType.FUNCTION,
          source_code: 'fn test_function() {}',
          agent_summary: null,
        },
        {
          id: 2,
          module_id: 2,
          name: 'another_function',
          item_type: ItemType.FUNCTION,
          source_code: 'fn another_function() {}',
          agent_summary: null,
        },
      ]

      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: mockItems }),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.getItemsByType(ItemType.FUNCTION)

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT * FROM items WHERE item_type = ? ORDER BY name',
      )
      expect(mockPreparedStatement.bind).toHaveBeenCalledWith(ItemType.FUNCTION)
      expect(result).toEqual(mockItems)
    })
  })

  describe('getItemsByModuleAndType', () => {
    it('should return items filtered by module and type', async () => {
      const mockItems = [
        {
          id: 1,
          module_id: 1,
          name: 'test_function',
          item_type: ItemType.FUNCTION,
          source_code: 'fn test_function() {}',
          agent_summary: null,
        },
      ]

      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: mockItems }),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.getItemsByModuleAndType(
        1,
        ItemType.FUNCTION,
      )

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT * FROM items WHERE module_id = ? AND item_type = ? ORDER BY name',
      )
      expect(mockPreparedStatement.bind).toHaveBeenCalledWith(
        1,
        ItemType.FUNCTION,
      )
      expect(result).toEqual(mockItems)
    })
  })

  describe('updateItemSummary', () => {
    it('should update item summary successfully', async () => {
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

      await repository.updateItemSummary({
        id: 1,
        summary: 'Updated summary',
      })

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'UPDATE items SET agent_summary = ? WHERE id = ?',
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
        repository.updateItemSummary({
          id: 1,
          summary: 'Updated summary',
        }),
      ).rejects.toThrow('Failed to update item summary: Database error')
    })

    it('should throw error when item not found', async () => {
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
        repository.updateItemSummary({
          id: 999,
          summary: 'Updated summary',
        }),
      ).rejects.toThrow('Item with id 999 not found')
    })
  })

  describe('batchCreateItems', () => {
    it('should create multiple items successfully', async () => {
      const mockItems = [
        {
          id: 1,
          module_id: 1,
          name: 'test_function',
          item_type: ItemType.FUNCTION,
          source_code: 'fn test_function() {}',
          agent_summary: null,
        },
        {
          id: 2,
          module_id: 1,
          name: 'TestStruct',
          item_type: ItemType.STRUCT,
          source_code: 'struct TestStruct {}',
          agent_summary: 'A test struct',
        },
      ]

      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        first: vi
          .fn()
          .mockResolvedValueOnce(mockItems[0])
          .mockResolvedValueOnce(mockItems[1]),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.batchCreateItems({
        items: [
          {
            module_id: 1,
            name: 'test_function',
            item_type: ItemType.FUNCTION,
            source_code: 'fn test_function() {}',
          },
          {
            module_id: 1,
            name: 'TestStruct',
            item_type: ItemType.STRUCT,
            source_code: 'struct TestStruct {}',
            agent_summary: 'A test struct',
          },
        ],
      })

      expect(mockDb.prepare).toHaveBeenCalledTimes(2)
      expect(result).toEqual(mockItems)
    })
  })

  describe('getItemCount', () => {
    it('should return total count of items', async () => {
      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ count: 25 }),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.getItemCount()

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM items',
      )
      expect(result).toBe(25)
    })

    it('should return count of items for specific module', async () => {
      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ count: 10 }),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.getItemCount(1)

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM items WHERE module_id = ?',
      )
      expect(mockPreparedStatement.bind).toHaveBeenCalledWith(1)
      expect(result).toBe(10)
    })

    it('should return count of items for specific type', async () => {
      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ count: 5 }),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.getItemCount(undefined, ItemType.FUNCTION)

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM items WHERE item_type = ?',
      )
      expect(mockPreparedStatement.bind).toHaveBeenCalledWith(ItemType.FUNCTION)
      expect(result).toBe(5)
    })

    it('should return count of items for specific module and type', async () => {
      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ count: 3 }),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.getItemCount(1, ItemType.FUNCTION)

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM items WHERE module_id = ? AND item_type = ?',
      )
      expect(mockPreparedStatement.bind).toHaveBeenCalledWith(
        1,
        ItemType.FUNCTION,
      )
      expect(result).toBe(3)
    })
  })

  describe('getItemTypeDistribution', () => {
    it('should return distribution of item types', async () => {
      const mockResult = [
        { item_type: ItemType.FUNCTION, count: 10 },
        { item_type: ItemType.STRUCT, count: 5 },
        { item_type: ItemType.ENUM, count: 2 },
      ]

      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: mockResult }),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.getItemTypeDistribution()

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT item_type, COUNT(*) as count FROM items GROUP BY item_type',
      )
      expect(result).toEqual({
        [ItemType.FUNCTION]: 10,
        [ItemType.STRUCT]: 5,
        [ItemType.ENUM]: 2,
        [ItemType.IMPL]: 0,
        [ItemType.MOD]: 0,
        [ItemType.TRAIT]: 0,
        [ItemType.TYPE_ALIAS]: 0,
        [ItemType.CONST]: 0,
        [ItemType.STATIC]: 0,
        [ItemType.USE]: 0,
        [ItemType.MACRO]: 0,
      })
    })

    it('should return distribution for specific module', async () => {
      const mockResult = [
        { item_type: ItemType.FUNCTION, count: 3 },
        { item_type: ItemType.STRUCT, count: 2 },
      ]

      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: mockResult }),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.getItemTypeDistribution(1)

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT item_type, COUNT(*) as count FROM items WHERE module_id = ? GROUP BY item_type',
      )
      expect(mockPreparedStatement.bind).toHaveBeenCalledWith(1)
      expect(result).toEqual({
        [ItemType.FUNCTION]: 3,
        [ItemType.STRUCT]: 2,
        [ItemType.ENUM]: 0,
        [ItemType.IMPL]: 0,
        [ItemType.MOD]: 0,
        [ItemType.TRAIT]: 0,
        [ItemType.TYPE_ALIAS]: 0,
        [ItemType.CONST]: 0,
        [ItemType.STATIC]: 0,
        [ItemType.USE]: 0,
        [ItemType.MACRO]: 0,
      })
    })
  })

  describe('searchItemsByName', () => {
    it('should search items by name pattern', async () => {
      const mockItems = [
        {
          id: 1,
          module_id: 1,
          name: 'test_function',
          item_type: ItemType.FUNCTION,
          source_code: 'fn test_function() {}',
          agent_summary: null,
        },
        {
          id: 2,
          module_id: 1,
          name: 'TestStruct',
          item_type: ItemType.STRUCT,
          source_code: 'struct TestStruct {}',
          agent_summary: null,
        },
      ]

      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: mockItems }),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.searchItemsByName('test')

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT * FROM items WHERE name LIKE ? ORDER BY name',
      )
      expect(mockPreparedStatement.bind).toHaveBeenCalledWith('%test%')
      expect(result).toEqual(mockItems)
    })
  })

  describe('searchItemsBySourceCode', () => {
    it('should search items by source code pattern', async () => {
      const mockItems = [
        {
          id: 1,
          module_id: 1,
          name: 'test_function',
          item_type: ItemType.FUNCTION,
          source_code: 'fn test_function() {}',
          agent_summary: null,
        },
      ]

      const mockPreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: mockItems }),
      }

      vi.mocked(mockDb.prepare).mockReturnValue(
        mockPreparedStatement as unknown as D1PreparedStatement,
      )

      const result = await repository.searchItemsBySourceCode('fn test')

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT * FROM items WHERE source_code LIKE ? ORDER BY name',
      )
      expect(mockPreparedStatement.bind).toHaveBeenCalledWith('%fn test%')
      expect(result).toEqual(mockItems)
    })
  })
})
