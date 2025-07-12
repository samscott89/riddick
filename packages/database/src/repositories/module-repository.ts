import type {
  Module,
  CreateModuleRequest,
  UpdateSummaryRequest,
} from '@riddick/types'

export class ModuleRepository {
  constructor(private db: D1Database) {}

  async createModule(request: CreateModuleRequest): Promise<Module> {
    const { crate_id, path, agent_summary } = request

    const result = await this.db
      .prepare(
        'INSERT INTO modules (crate_id, path, agent_summary) VALUES (?, ?, ?) RETURNING *',
      )
      .bind(crate_id, path, agent_summary || null)
      .first<Module>()

    if (!result) {
      throw new Error('Failed to create module')
    }

    return result
  }

  async getModule(id: number): Promise<Module | null> {
    const result = await this.db
      .prepare('SELECT * FROM modules WHERE id = ?')
      .bind(id)
      .first<Module>()

    return result || null
  }

  async getModulesByCrate(crateId: number): Promise<Module[]> {
    const result = await this.db
      .prepare('SELECT * FROM modules WHERE crate_id = ? ORDER BY path')
      .bind(crateId)
      .all<Module>()

    return result.results
  }

  async getModuleByPath(crateId: number, path: string): Promise<Module | null> {
    const result = await this.db
      .prepare('SELECT * FROM modules WHERE crate_id = ? AND path = ?')
      .bind(crateId, path)
      .first<Module>()

    return result || null
  }

  async updateModuleSummary(request: UpdateSummaryRequest): Promise<void> {
    const { id, summary } = request

    const result = await this.db
      .prepare('UPDATE modules SET agent_summary = ? WHERE id = ?')
      .bind(summary, id)
      .run()

    if (!result.success) {
      throw new Error(`Failed to update module summary: ${result.error}`)
    }

    if (!result.meta.changes || result.meta.changes === 0) {
      throw new Error(`Module with id ${id} not found`)
    }
  }

  async deleteModule(id: number): Promise<void> {
    const result = await this.db
      .prepare('DELETE FROM modules WHERE id = ?')
      .bind(id)
      .run()

    if (!result.success) {
      throw new Error(`Failed to delete module: ${result.error}`)
    }

    if (!result.meta.changes || result.meta.changes === 0) {
      throw new Error(`Module with id ${id} not found`)
    }
  }

  async batchCreateModules(modules: CreateModuleRequest[]): Promise<Module[]> {
    const results: Module[] = []

    for (const moduleRequest of modules) {
      const module = await this.createModule(moduleRequest)
      results.push(module)
    }

    return results
  }

  async getModuleCount(crateId?: number): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM modules'
    const params: unknown[] = []

    if (crateId !== undefined) {
      query += ' WHERE crate_id = ?'
      params.push(crateId)
    }

    const result = await this.db
      .prepare(query)
      .bind(...params)
      .first<{ count: number }>()

    return result?.count || 0
  }

  async listModules(limit = 50, offset = 0): Promise<Module[]> {
    const result = await this.db
      .prepare('SELECT * FROM modules ORDER BY path LIMIT ? OFFSET ?')
      .bind(limit, offset)
      .all<Module>()

    return result.results
  }

  async searchModulesByPath(pathPattern: string): Promise<Module[]> {
    const result = await this.db
      .prepare('SELECT * FROM modules WHERE path LIKE ? ORDER BY path')
      .bind(`%${pathPattern}%`)
      .all<Module>()

    return result.results
  }
}
