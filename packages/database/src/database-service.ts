import {
  CrateRepository,
} from './repositories'
import type {
  Crate,
  CreateCrateRequest,
} from '@riddick/types'
import { CrateStatus } from '@riddick/types'

export class DatabaseService {
  private crateRepository: CrateRepository

  constructor(db: D1Database) {
    this.crateRepository = new CrateRepository(db)
  }

  get crates(): CrateRepository {
    return this.crateRepository
  }



  async deleteCrateWithDependencies(crateId: number): Promise<void> {
    await this.crateRepository.deleteCrate(crateId)
  }

  async updateCrateProgress(
    crateId: number,
    status: CrateStatus,
    errorMessage?: string,
  ): Promise<void> {
    await this.crateRepository.updateCrateStatus({
      id: crateId,
      status,
      error_message: errorMessage,
    })
  }

  async updateCrateWorkflowId(id: number, workflowId: string): Promise<void> {
    await this.crateRepository.updateCrateWorkflowId(id, workflowId)
  }

  async getDatabaseStatistics(): Promise<{
    totalCrates: number
    cratesByStatus: Record<CrateStatus, number>
  }> {
    const totalCrates = await this.crateRepository.getCrateCount()

    const cratesByStatus = {} as Record<CrateStatus, number>

    const statusPromises = Object.values(CrateStatus).map(async (status) => {
      const crates = await this.crateRepository.getCratesByStatus(status)
      cratesByStatus[status] = crates.length
    })

    await Promise.all(statusPromises)

    return {
      totalCrates,
      cratesByStatus,
    }
  }

}
