import type {
  Crate,
  CrateStatus,
  CreateCrateRequest,
  UpdateCrateStatusRequest,
} from '@riddick/types'

export class CrateRepository {
  constructor(private db: D1Database) {}

  async createCrate(request: CreateCrateRequest): Promise<Crate> {
    const { name, version, agent_summary, status } = request

    const result = await this.db
      .prepare(
        'INSERT INTO crates (name, version, agent_summary, status) VALUES (?, ?, ?, ?) RETURNING *',
      )
      .bind(name, version, agent_summary || null, status)
      .first<Crate>()

    if (!result) {
      throw new Error('Failed to create crate')
    }

    return result
  }

  async getCrate(id: number): Promise<Crate | null> {
    const result = await this.db
      .prepare('SELECT * FROM crates WHERE id = ?')
      .bind(id)
      .first<Crate>()

    return result || null
  }

  async getCrateByNameVersion(
    name: string,
    version: string,
  ): Promise<Crate | null> {
    const result = await this.db
      .prepare('SELECT * FROM crates WHERE name = ? AND version = ?')
      .bind(name, version)
      .first<Crate>()

    return result || null
  }

  async updateCrateStatus(request: UpdateCrateStatusRequest): Promise<void> {
    const { id, status, error_message } = request

    const result = await this.db
      .prepare('UPDATE crates SET status = ?, error_message = ? WHERE id = ?')
      .bind(status, error_message || null, id)
      .run()

    if (!result.success) {
      throw new Error(`Failed to update crate status: ${result.error}`)
    }

    if (!result.meta.changes || result.meta.changes === 0) {
      throw new Error(`Crate with id ${id} not found`)
    }
  }

  async updateCrateSummary(id: number, summary: string): Promise<void> {
    const result = await this.db
      .prepare('UPDATE crates SET agent_summary = ? WHERE id = ?')
      .bind(summary, id)
      .run()

    if (!result.success) {
      throw new Error(`Failed to update crate summary: ${result.error}`)
    }

    if (!result.meta.changes || result.meta.changes === 0) {
      throw new Error(`Crate with id ${id} not found`)
    }
  }

  async updateCrateWorkflowId(id: number, workflowId: string): Promise<void> {
    const result = await this.db
      .prepare('UPDATE crates SET workflow_id = ? WHERE id = ?')
      .bind(workflowId, id)
      .run()

    if (!result.success) {
      throw new Error(`Failed to update crate workflow ID: ${result.error}`)
    }

    if (!result.meta.changes || result.meta.changes === 0) {
      throw new Error(`Crate with id ${id} not found`)
    }
  }

  async deleteCrate(id: number): Promise<void> {
    const result = await this.db
      .prepare('DELETE FROM crates WHERE id = ?')
      .bind(id)
      .run()

    if (!result.success) {
      throw new Error(`Failed to delete crate: ${result.error}`)
    }

    if (!result.meta.changes || result.meta.changes === 0) {
      throw new Error(`Crate with id ${id} not found`)
    }
  }

  async listCrates(limit = 50, offset = 0): Promise<Crate[]> {
    const result = await this.db
      .prepare('SELECT * FROM crates ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .bind(limit, offset)
      .all<Crate>()

    return result.results
  }

  async getCratesByStatus(status: CrateStatus): Promise<Crate[]> {
    const result = await this.db
      .prepare('SELECT * FROM crates WHERE status = ? ORDER BY created_at DESC')
      .bind(status)
      .all<Crate>()

    return result.results
  }

  async getCrateCount(): Promise<number> {
    const result = await this.db
      .prepare('SELECT COUNT(*) as count FROM crates')
      .first<{ count: number }>()

    return result?.count || 0
  }
}
