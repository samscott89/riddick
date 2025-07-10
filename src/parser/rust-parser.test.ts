import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from 'vitest'

import { ParseErrorHandler, validateRustCode } from './error-handler'
import type { RustParser } from './rust-parser'
import { createRustParser, parseRustCode } from './rust-parser'
import { TEST_FIXTURES } from './test-fixtures'
import type { ParserOptions } from './types'

// Mock web-tree-sitter since we don't have the actual WASM file in tests
vi.mock('web-tree-sitter', () => {
  const mockNode = {
    type: 'source_file',
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 0, column: 0 },
    startIndex: 0,
    endIndex: 0,
    text: '',
    hasError: (): boolean => false,
    childCount: 0,
    child: (): null => null,
    childForFieldName: (): null => null,
  }

  const mockTree = {
    rootNode: mockNode,
  }

  const mockLanguage = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: (): any => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      captures: (): any[] => [],
    }),
  }

  const mockParser = {
    setLanguage: vi.fn(),
    parse: vi.fn(() => mockTree),
    delete: vi.fn(),
  }

  class MockParser {
    static init = vi.fn().mockResolvedValue(undefined)
    static Language = {
      load: vi.fn().mockResolvedValue(mockLanguage),
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(): any {
      return mockParser
    }
  }

  return {
    default: MockParser,
  }
})

describe('RustParser', () => {
  let parser: RustParser

  beforeAll(async () => {
    parser = createRustParser()
    await parser.initialize()
  })

  afterAll(() => {
    parser.dispose()
  })

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const testParser = createRustParser()
      await expect(testParser.initialize()).resolves.not.toThrow()
      testParser.dispose()
    })

    it('should throw error if parsing without initialization', async () => {
      const testParser = createRustParser()
      await expect(testParser.parseString('fn main() {}')).rejects.toThrow(
        'Parser not initialized',
      )
    })
  })

  describe('parsing simple functions', () => {
    it('should parse a simple function', async () => {
      const result = await parser.parseString(TEST_FIXTURES.SIMPLE_FUNCTION)

      expect(result.success).toBe(true)
      expect(result.crate).toBeDefined()
      expect(result.crate?.rootModule.items).toHaveLength(1)

      const func = result.crate?.rootModule.items[0]
      expect(func?.type).toBe('function')
      expect(func?.name).toBe('greet')
    })

    it('should parse generic functions', async () => {
      const result = await parser.parseString(TEST_FIXTURES.GENERIC_FUNCTION)

      expect(result.success).toBe(true)
      expect(result.crate?.rootModule.items).toHaveLength(1)

      const func = result.crate?.rootModule.items[0]
      expect(func?.type).toBe('function')
      expect(func?.name).toBe('swap')
      expect(func?.genericParameters).toContain('T')
    })

    it('should parse async functions', async () => {
      const result = await parser.parseString(TEST_FIXTURES.ASYNC_FUNCTION)

      expect(result.success).toBe(true)
      expect(result.crate?.rootModule.items).toHaveLength(1)

      const func = result.crate?.rootModule.items[0]
      expect(func?.type).toBe('function')
      expect(func?.name).toBe('fetch_data')
    })
  })

  describe('parsing structs', () => {
    it('should parse a simple struct', async () => {
      const result = await parser.parseString(TEST_FIXTURES.SIMPLE_STRUCT)

      expect(result.success).toBe(true)
      expect(result.crate?.rootModule.items).toHaveLength(1)

      const struct = result.crate?.rootModule.items[0]
      expect(struct?.type).toBe('struct')
      expect(struct?.name).toBe('Point')
      expect(struct?.fields).toHaveLength(2)
    })

    it('should parse generic structs', async () => {
      const result = await parser.parseString(TEST_FIXTURES.GENERIC_STRUCT)

      expect(result.success).toBe(true)
      expect(result.crate?.rootModule.items).toHaveLength(1)

      const struct = result.crate?.rootModule.items[0]
      expect(struct?.type).toBe('struct')
      expect(struct?.name).toBe('Vec3')
      expect(struct?.visibility).toBe('pub')
      expect(struct?.genericParameters).toContain('T')
    })

    it('should parse tuple structs', async () => {
      const result = await parser.parseString(TEST_FIXTURES.TUPLE_STRUCT)

      expect(result.success).toBe(true)
      expect(result.crate?.rootModule.items).toHaveLength(1)

      const struct = result.crate?.rootModule.items[0]
      expect(struct?.type).toBe('struct')
      expect(struct?.name).toBe('Color')
      expect(struct?.visibility).toBe('pub')
    })

    it('should parse unit structs', async () => {
      const result = await parser.parseString(TEST_FIXTURES.UNIT_STRUCT)

      expect(result.success).toBe(true)
      expect(result.crate?.rootModule.items).toHaveLength(1)

      const struct = result.crate?.rootModule.items[0]
      expect(struct?.type).toBe('struct')
      expect(struct?.name).toBe('Unit')
    })
  })

  describe('parsing enums', () => {
    it('should parse a simple enum', async () => {
      const result = await parser.parseString(TEST_FIXTURES.SIMPLE_ENUM)

      expect(result.success).toBe(true)
      expect(result.crate?.rootModule.items).toHaveLength(1)

      const enumItem = result.crate?.rootModule.items[0]
      expect(enumItem?.type).toBe('enum')
      expect(enumItem?.name).toBe('Direction')
      expect(enumItem?.variants).toHaveLength(4)
    })

    it('should parse complex enums', async () => {
      const result = await parser.parseString(TEST_FIXTURES.COMPLEX_ENUM)

      expect(result.success).toBe(true)
      expect(result.crate?.rootModule.items).toHaveLength(1)

      const enumItem = result.crate?.rootModule.items[0]
      expect(enumItem?.type).toBe('enum')
      expect(enumItem?.name).toBe('Message')
      expect(enumItem?.visibility).toBe('pub')
      expect(enumItem?.variants).toHaveLength(4)
    })

    it('should parse generic enums', async () => {
      const result = await parser.parseString(TEST_FIXTURES.GENERIC_ENUM)

      expect(result.success).toBe(true)
      expect(result.crate?.rootModule.items).toHaveLength(1)

      const enumItem = result.crate?.rootModule.items[0]
      expect(enumItem?.type).toBe('enum')
      expect(enumItem?.name).toBe('Option')
      expect(enumItem?.genericParameters).toContain('T')
    })
  })

  describe('parsing traits', () => {
    it('should parse trait definitions', async () => {
      const result = await parser.parseString(TEST_FIXTURES.TRAIT_DEFINITION)

      expect(result.success).toBe(true)
      expect(result.crate?.rootModule.items).toHaveLength(1)

      const trait = result.crate?.rootModule.items[0]
      expect(trait?.type).toBe('trait')
      expect(trait?.name).toBe('Draw')
      expect(trait?.visibility).toBe('pub')
    })

    it('should parse traits with generics', async () => {
      const result = await parser.parseString(TEST_FIXTURES.TRAIT_WITH_GENERICS)

      expect(result.success).toBe(true)
      expect(result.crate?.rootModule.items).toHaveLength(1)

      const trait = result.crate?.rootModule.items[0]
      expect(trait?.type).toBe('trait')
      expect(trait?.name).toBe('Iterator')
      expect(trait?.visibility).toBe('pub')
      expect(trait?.genericParameters).toContain('T')
    })
  })

  describe('parsing impl blocks', () => {
    it('should parse impl blocks', async () => {
      const result = await parser.parseString(TEST_FIXTURES.IMPL_BLOCK)

      expect(result.success).toBe(true)
      expect(result.crate?.rootModule.items).toHaveLength(1)

      const impl = result.crate?.rootModule.items[0]
      expect(impl?.type).toBe('impl')
      expect(impl?.implType).toBe('Point')
      expect(impl?.associatedItems).toHaveLength(2)
    })

    it('should parse trait implementations', async () => {
      const result = await parser.parseString(TEST_FIXTURES.TRAIT_IMPL)

      expect(result.success).toBe(true)
      expect(result.crate?.rootModule.items).toHaveLength(1)

      const impl = result.crate?.rootModule.items[0]
      expect(impl?.type).toBe('impl')
      expect(impl?.implType).toBe('Point')
      expect(impl?.traitName).toBe('Draw')
    })

    it('should parse generic impl blocks', async () => {
      const result = await parser.parseString(TEST_FIXTURES.GENERIC_IMPL)

      expect(result.success).toBe(true)
      expect(result.crate?.rootModule.items).toHaveLength(1)

      const impl = result.crate?.rootModule.items[0]
      expect(impl?.type).toBe('impl')
      expect(impl?.implType).toBe('Vec3<T>')
      expect(impl?.genericParameters).toContain('T')
    })
  })

  describe('parsing modules', () => {
    it('should parse module definitions', async () => {
      const result = await parser.parseString(TEST_FIXTURES.MODULE_DEFINITION)

      expect(result.success).toBe(true)
      expect(result.crate?.rootModule.items).toHaveLength(1)

      const module = result.crate?.rootModule.items[0]
      expect(module?.type).toBe('mod')
      expect(module?.name).toBe('geometry')
      expect(module?.visibility).toBe('pub')
    })
  })

  describe('parsing use statements', () => {
    it('should parse use statements', async () => {
      const result = await parser.parseString(TEST_FIXTURES.USE_STATEMENTS)

      expect(result.success).toBe(true)
      expect(result.crate?.rootModule.items).toHaveLength(4)

      const uses = result.crate?.rootModule.items.filter(
        (item) => item.type === 'use',
      )
      expect(uses).toHaveLength(4)
    })
  })

  describe('parsing constants and statics', () => {
    it('should parse constants and statics', async () => {
      const result = await parser.parseString(
        TEST_FIXTURES.CONSTANTS_AND_STATICS,
      )

      expect(result.success).toBe(true)
      expect(result.crate?.rootModule.items.length).toBeGreaterThan(0)

      const constants =
        result.crate?.rootModule.items.filter(
          (item) => item.type === 'const',
        ) || []
      const statics =
        result.crate?.rootModule.items.filter(
          (item) => item.type === 'static',
        ) || []

      expect(constants.length).toBeGreaterThan(0)
      expect(statics.length).toBeGreaterThan(0)
    })
  })

  describe('parsing type aliases', () => {
    it('should parse type aliases', async () => {
      const result = await parser.parseString(TEST_FIXTURES.TYPE_ALIASES)

      expect(result.success).toBe(true)
      expect(result.crate?.rootModule.items.length).toBeGreaterThan(0)

      const typeAliases =
        result.crate?.rootModule.items.filter(
          (item) => item.type === 'type_alias',
        ) || []
      expect(typeAliases.length).toBeGreaterThan(0)
    })
  })

  describe('parsing macros', () => {
    it('should parse macro definitions', async () => {
      const result = await parser.parseString(TEST_FIXTURES.MACRO_DEFINITION)

      expect(result.success).toBe(true)
      expect(result.crate?.rootModule.items).toHaveLength(1)

      const macro = result.crate?.rootModule.items[0]
      expect(macro?.type).toBe('macro')
      expect(macro?.name).toBe('vec')
    })
  })

  describe('parsing attributes and derives', () => {
    it('should parse attributes and derives', async () => {
      const result = await parser.parseString(
        TEST_FIXTURES.ATTRIBUTES_AND_DERIVES,
      )

      expect(result.success).toBe(true)
      expect(result.crate?.rootModule.items).toHaveLength(1)

      const struct = result.crate?.rootModule.items[0]
      expect(struct?.type).toBe('struct')
      expect(struct?.name).toBe('User')
      expect(struct?.attributes).toBeDefined()
      expect(struct?.attributes?.length).toBeGreaterThan(0)
    })
  })

  describe('parsing complete modules', () => {
    it('should parse a complete module', async () => {
      const result = await parser.parseString(TEST_FIXTURES.COMPLETE_MODULE)

      expect(result.success).toBe(true)
      expect(result.crate?.rootModule.items.length).toBeGreaterThan(5)

      const structs =
        result.crate?.rootModule.items.filter(
          (item) => item.type === 'struct',
        ) || []
      const enums =
        result.crate?.rootModule.items.filter((item) => item.type === 'enum') ||
        []
      const traits =
        result.crate?.rootModule.items.filter(
          (item) => item.type === 'trait',
        ) || []
      const impls =
        result.crate?.rootModule.items.filter((item) => item.type === 'impl') ||
        []
      const modules =
        result.crate?.rootModule.items.filter((item) => item.type === 'mod') ||
        []

      expect(structs.length).toBeGreaterThan(0)
      expect(enums.length).toBeGreaterThan(0)
      expect(traits.length).toBeGreaterThan(0)
      expect(impls.length).toBeGreaterThan(0)
      expect(modules.length).toBeGreaterThan(0)
    })
  })

  describe('error handling', () => {
    it('should handle syntax errors', async () => {
      const result = await parser.parseString(TEST_FIXTURES.SYNTAX_ERRORS)

      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should handle empty input', async () => {
      const result = await parser.parseString('')

      expect(result.success).toBe(true)
      expect(result.crate?.rootModule.items).toHaveLength(0)
    })

    it('should handle invalid Rust code', async () => {
      const result = await parser.parseString('this is not rust code')

      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('performance', () => {
    it('should handle large files', async () => {
      const startTime = Date.now()
      const result = await parser.parseString(TEST_FIXTURES.LARGE_FILE)
      const endTime = Date.now()

      expect(result.success).toBe(true)
      expect(endTime - startTime).toBeLessThan(5000) // Should complete within 5 seconds
      expect(result.crate?.rootModule.items.length).toBeGreaterThan(90)
    })
  })

  describe('parser options', () => {
    it('should respect parser options', async () => {
      const options: ParserOptions = {
        includeComments: true,
        includeDocComments: true,
        includePrivateItems: false,
        maxDepth: 10,
        timeout: 5000,
      }

      const testParser = createRustParser(options)
      await testParser.initialize()

      const result = await testParser.parseString(TEST_FIXTURES.SIMPLE_FUNCTION)
      expect(result.success).toBe(true)

      testParser.dispose()
    })
  })
})

describe('parseRustCode utility function', () => {
  it('should parse code and dispose parser automatically', async () => {
    const result = await parseRustCode(TEST_FIXTURES.SIMPLE_FUNCTION)

    expect(result.success).toBe(true)
    expect(result.crate?.rootModule.items).toHaveLength(1)
  })
})

describe('ParseErrorHandler', () => {
  let errorHandler: ParseErrorHandler

  beforeEach(() => {
    errorHandler = new ParseErrorHandler()
  })

  it('should add and retrieve errors', () => {
    errorHandler.addError('Test error')
    errorHandler.addWarning('Test warning')

    expect(errorHandler.hasErrors()).toBe(true)
    expect(errorHandler.hasWarnings()).toBe(true)
    expect(errorHandler.getErrors()).toHaveLength(1)
    expect(errorHandler.getWarnings()).toHaveLength(1)
    expect(errorHandler.getAllErrors()).toHaveLength(2)
  })

  it('should format errors correctly', () => {
    const location = {
      startLine: 1,
      startColumn: 5,
      endLine: 1,
      endColumn: 10,
      startByte: 4,
      endByte: 9,
    }

    errorHandler.addError('Test error', location)

    const formatted = errorHandler.formatError(errorHandler.getAllErrors()[0])
    expect(formatted).toContain('ERROR at 1:5')
    expect(formatted).toContain('Test error')
  })

  it('should clear all errors', () => {
    errorHandler.addError('Test error')
    errorHandler.addWarning('Test warning')

    expect(errorHandler.getAllErrors()).toHaveLength(2)

    errorHandler.clear()
    expect(errorHandler.getAllErrors()).toHaveLength(0)
  })
})

describe('validateRustCode', () => {
  it('should validate empty code', () => {
    const errors = validateRustCode('')
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain('empty')
  })

  it('should detect unterminated comments', () => {
    const errors = validateRustCode('/* unterminated comment')
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain('Unterminated block comment')
  })

  it('should detect common syntax mistakes', () => {
    const errors = validateRustCode('function main() { var x = 5; }')
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some((e) => e.message.includes('fn'))).toBe(true)
    expect(errors.some((e) => e.message.includes('let'))).toBe(true)
  })

  it('should validate correct code', () => {
    const errors = validateRustCode('fn main() { let x = 5; }')
    expect(errors).toHaveLength(0)
  })
})
