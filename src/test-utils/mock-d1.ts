import { vi } from 'vitest'

export function createMockD1PreparedStatement(
  overrides: Partial<D1PreparedStatement> = {},
): D1PreparedStatement {
  return {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn(),
    run: vi.fn(),
    all: vi.fn(),
    raw: vi.fn(),
    ...overrides,
  } as unknown as D1PreparedStatement
}

export function createMockD1Database(): D1Database {
  return {
    prepare: vi.fn(),
    dump: vi.fn(),
    batch: vi.fn(),
    exec: vi.fn(),
  } as unknown as D1Database
}
