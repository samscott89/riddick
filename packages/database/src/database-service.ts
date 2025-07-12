import {
  CrateRepository,
  ModuleRepository,
  ItemRepository,
} from './repositories'
import type {
  Crate,
  Module,
  Item,
  ItemType,
  CreateCrateRequest,
  CreateModuleRequest,
  CreateItemRequest,
} from '@riddick/types'
import { CrateStatus } from '@riddick/types'

export class DatabaseService {
  private crateRepository: CrateRepository
  private moduleRepository: ModuleRepository
  private itemRepository: ItemRepository

  constructor(db: D1Database) {
    this.crateRepository = new CrateRepository(db)
    this.moduleRepository = new ModuleRepository(db)
    this.itemRepository = new ItemRepository(db)
  }

  get crates(): CrateRepository {
    return this.crateRepository
  }

  get modules(): ModuleRepository {
    return this.moduleRepository
  }

  get items(): ItemRepository {
    return this.itemRepository
  }

  async createCrateWithModulesAndItems(
    crateRequest: CreateCrateRequest,
    moduleRequests: Omit<CreateModuleRequest, 'crate_id'>[],
    itemRequests: Omit<CreateItemRequest, 'module_id'>[],
  ): Promise<{
    crate: Crate
    modules: Module[]
    items: Item[]
  }> {
    const crate = await this.crateRepository.createCrate(crateRequest)

    const modules = await Promise.all(
      moduleRequests.map((moduleRequest) =>
        this.moduleRepository.createModule({
          ...moduleRequest,
          crate_id: crate.id,
        }),
      ),
    )

    const items = await Promise.all(
      modules.flatMap((module, moduleIndex) =>
        itemRequests
          .filter((_, itemIndex) => itemIndex % modules.length === moduleIndex)
          .map((itemRequest) =>
            this.itemRepository.createItem({
              ...itemRequest,
              module_id: module.id,
            }),
          ),
      ),
    )

    return { crate, modules, items }
  }

  async getCrateWithModulesAndItems(crateId: number): Promise<{
    crate: Crate | null
    modules: Module[]
    items: Item[]
  }> {
    const crate = await this.crateRepository.getCrate(crateId)

    if (!crate) {
      return { crate: null, modules: [], items: [] }
    }

    const modules = await this.moduleRepository.getModulesByCrate(crateId)
    const items = await Promise.all(
      modules.map((module) => this.itemRepository.getItemsByModule(module.id)),
    ).then((itemArrays) => itemArrays.flat())

    return { crate, modules, items }
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

  async getDatabaseStatistics(): Promise<{
    totalCrates: number
    totalModules: number
    totalItems: number
    cratesByStatus: Record<CrateStatus, number>
    itemsByType: Record<ItemType, number>
  }> {
    const [totalCrates, totalModules, totalItems] = await Promise.all([
      this.crateRepository.getCrateCount(),
      this.moduleRepository.getModuleCount(),
      this.itemRepository.getItemCount(),
    ])

    const cratesByStatus = {} as Record<CrateStatus, number>

    const statusPromises = Object.values(CrateStatus).map(async (status) => {
      const crates = await this.crateRepository.getCratesByStatus(status)
      cratesByStatus[status] = crates.length
    })

    await Promise.all(statusPromises)

    const itemsByType = await this.itemRepository.getItemTypeDistribution()

    return {
      totalCrates,
      totalModules,
      totalItems,
      cratesByStatus,
      itemsByType,
    }
  }

  async searchAcrossDatabase(query: string): Promise<{
    crates: Crate[]
    modules: Module[]
    items: Item[]
  }> {
    const [modules, items] = await Promise.all([
      this.moduleRepository.searchModulesByPath(query),
      this.itemRepository.searchItemsByName(query),
    ])

    return {
      crates: [],
      modules,
      items,
    }
  }
}
