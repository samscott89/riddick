import type {
  Item,
  CreateItemRequest,
  UpdateSummaryRequest,
  BatchCreateItemsRequest,
} from '@riddick/types'
import { ItemType } from '@riddick/types'

export class ItemRepository {
  constructor(private db: D1Database) {}

  async createItem(request: CreateItemRequest): Promise<Item> {
    const { module_id, name, item_type, source_code, agent_summary } = request

    const result = await this.db
      .prepare(
        'INSERT INTO items (module_id, name, item_type, source_code, agent_summary) VALUES (?, ?, ?, ?, ?) RETURNING *',
      )
      .bind(module_id, name, item_type, source_code, agent_summary || null)
      .first<Item>()

    if (!result) {
      throw new Error('Failed to create item')
    }

    return result
  }

  async getItem(id: number): Promise<Item | null> {
    const result = await this.db
      .prepare('SELECT * FROM items WHERE id = ?')
      .bind(id)
      .first<Item>()

    return result || null
  }

  async getItemsByModule(moduleId: number): Promise<Item[]> {
    const result = await this.db
      .prepare('SELECT * FROM items WHERE module_id = ? ORDER BY name')
      .bind(moduleId)
      .all<Item>()

    return result.results
  }

  async getItemsByType(itemType: ItemType): Promise<Item[]> {
    const result = await this.db
      .prepare('SELECT * FROM items WHERE item_type = ? ORDER BY name')
      .bind(itemType)
      .all<Item>()

    return result.results
  }

  async getItemsByModuleAndType(
    moduleId: number,
    itemType: ItemType,
  ): Promise<Item[]> {
    const result = await this.db
      .prepare(
        'SELECT * FROM items WHERE module_id = ? AND item_type = ? ORDER BY name',
      )
      .bind(moduleId, itemType)
      .all<Item>()

    return result.results
  }

  async getItemByName(moduleId: number, name: string): Promise<Item | null> {
    const result = await this.db
      .prepare('SELECT * FROM items WHERE module_id = ? AND name = ?')
      .bind(moduleId, name)
      .first<Item>()

    return result || null
  }

  async updateItemSummary(request: UpdateSummaryRequest): Promise<void> {
    const { id, summary } = request

    const result = await this.db
      .prepare('UPDATE items SET agent_summary = ? WHERE id = ?')
      .bind(summary, id)
      .run()

    if (!result.success) {
      throw new Error(`Failed to update item summary: ${result.error}`)
    }

    if (!result.meta.changes || result.meta.changes === 0) {
      throw new Error(`Item with id ${id} not found`)
    }
  }

  async updateItemSourceCode(id: number, sourceCode: string): Promise<void> {
    const result = await this.db
      .prepare('UPDATE items SET source_code = ? WHERE id = ?')
      .bind(sourceCode, id)
      .run()

    if (!result.success) {
      throw new Error(`Failed to update item source code: ${result.error}`)
    }

    if (!result.meta.changes || result.meta.changes === 0) {
      throw new Error(`Item with id ${id} not found`)
    }
  }

  async deleteItem(id: number): Promise<void> {
    const result = await this.db
      .prepare('DELETE FROM items WHERE id = ?')
      .bind(id)
      .run()

    if (!result.success) {
      throw new Error(`Failed to delete item: ${result.error}`)
    }

    if (!result.meta.changes || result.meta.changes === 0) {
      throw new Error(`Item with id ${id} not found`)
    }
  }

  async batchCreateItems(request: BatchCreateItemsRequest): Promise<Item[]> {
    const { items } = request
    const results: Item[] = []

    for (const itemRequest of items) {
      const item = await this.createItem(itemRequest)
      results.push(item)
    }

    return results
  }

  async getItemCount(moduleId?: number, itemType?: ItemType): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM items'
    const params: unknown[] = []
    const conditions: string[] = []

    if (moduleId !== undefined) {
      conditions.push('module_id = ?')
      params.push(moduleId)
    }

    if (itemType !== undefined) {
      conditions.push('item_type = ?')
      params.push(itemType)
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ')
    }

    const result = await this.db
      .prepare(query)
      .bind(...params)
      .first<{ count: number }>()

    return result?.count || 0
  }

  async listItems(limit = 50, offset = 0): Promise<Item[]> {
    const result = await this.db
      .prepare('SELECT * FROM items ORDER BY name LIMIT ? OFFSET ?')
      .bind(limit, offset)
      .all<Item>()

    return result.results
  }

  async searchItemsByName(namePattern: string): Promise<Item[]> {
    const result = await this.db
      .prepare('SELECT * FROM items WHERE name LIKE ? ORDER BY name')
      .bind(`%${namePattern}%`)
      .all<Item>()

    return result.results
  }

  async searchItemsBySourceCode(codePattern: string): Promise<Item[]> {
    const result = await this.db
      .prepare('SELECT * FROM items WHERE source_code LIKE ? ORDER BY name')
      .bind(`%${codePattern}%`)
      .all<Item>()

    return result.results
  }

  async getItemTypeDistribution(
    moduleId?: number,
  ): Promise<Record<ItemType, number>> {
    let query = 'SELECT item_type, COUNT(*) as count FROM items'
    const params: unknown[] = []

    if (moduleId !== undefined) {
      query += ' WHERE module_id = ?'
      params.push(moduleId)
    }

    query += ' GROUP BY item_type'

    const result = await this.db
      .prepare(query)
      .bind(...params)
      .all<{ item_type: ItemType; count: number }>()

    const distribution: Record<ItemType, number> = {
      [ItemType.FUNCTION]: 0,
      [ItemType.STRUCT]: 0,
      [ItemType.ENUM]: 0,
      [ItemType.IMPL]: 0,
      [ItemType.MOD]: 0,
      [ItemType.TRAIT]: 0,
      [ItemType.TYPE_ALIAS]: 0,
      [ItemType.CONST]: 0,
      [ItemType.STATIC]: 0,
      [ItemType.USE]: 0,
      [ItemType.MACRO]: 0,
    }

    for (const row of result.results) {
      distribution[row.item_type] = row.count
    }

    return distribution
  }
}
