import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { RustParser, createRustParser, parseRustCode } from './rust-parser'
import { TEST_FIXTURES } from './test-fixtures'
import type { ParserOptions } from './types'

describe('Rust Parser', () => {
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
      expect(result.crate?.rootModule.items.length).toBeGreaterThan(0)

      const func = result.crate?.rootModule.items.find(
        (item) => item.type === 'function',
      )
      expect(func).toBeDefined()
      expect(func?.name).toBe('greet')
      expect(func?.parameters).toBeDefined()
      expect(func?.parameters?.length).toBe(1)
    })

    it('should parse generic functions', async () => {
      const result = await parser.parseString(TEST_FIXTURES.GENERIC_FUNCTION)

      expect(result.success).toBe(true)
      expect(result.crate?.rootModule.items.length).toBeGreaterThan(0)

      const func = result.crate?.rootModule.items.find(
        (item) => item.type === 'function',
      )
      console.log(func)
      expect(func).toBeDefined()
      expect(func?.name).toBe('swap')
      expect(func?.genericParameters).toContain('T')
    })

    it('should parse async functions', async () => {
      const result = await parser.parseString(TEST_FIXTURES.ASYNC_FUNCTION)

      expect(result.success).toBe(true)
      expect(result.crate?.rootModule.items.length).toBeGreaterThan(0)

      const func = result.crate?.rootModule.items.find(
        (item) => item.type === 'function',
      )
      expect(func).toBeDefined()
      expect(func?.name).toBe('fetch_data')
    })
  })

  describe('parsing structs', () => {
    it('should parse a simple struct', async () => {
      const result = await parser.parseString(TEST_FIXTURES.SIMPLE_STRUCT)

      expect(result.success).toBe(true)
      expect(result.crate?.rootModule.items.length).toBeGreaterThan(0)

      const struct = result.crate?.rootModule.items.find(
        (item) => item.type === 'struct',
      )
      expect(struct).toBeDefined()
      expect(struct?.name).toBe('Point')
      expect(struct?.fields).toBeDefined()
      expect(struct?.fields?.length).toBe(2)
    })

    it('should parse generic structs', async () => {
      const result = await parser.parseString(TEST_FIXTURES.GENERIC_STRUCT)

      expect(result.success).toBe(true)
      expect(result.crate?.rootModule.items.length).toBeGreaterThan(0)

      const struct = result.crate?.rootModule.items.find(
        (item) => item.type === 'struct',
      )
      expect(struct).toBeDefined()
      expect(struct?.name).toBe('Vec3')
      expect(struct?.visibility).toBe('pub')
      expect(struct?.genericParameters).toContain('T')
    })

    it('should parse tuple structs', async () => {
      const result = await parser.parseString(TEST_FIXTURES.TUPLE_STRUCT)

      expect(result.success).toBe(true)
      expect(result.crate?.rootModule.items.length).toBeGreaterThan(0)

      const struct = result.crate?.rootModule.items.find(
        (item) => item.type === 'struct',
      )
      expect(struct).toBeDefined()
      expect(struct?.name).toBe('Color')
      expect(struct?.visibility).toBe('pub')
    })
  })

  describe('parsing enums', () => {
    it('should parse a simple enum', async () => {
      const result = await parser.parseString(TEST_FIXTURES.SIMPLE_ENUM)

      expect(result.success).toBe(true)
      expect(result.crate?.rootModule.items.length).toBeGreaterThan(0)

      const enumItem = result.crate?.rootModule.items.find(
        (item) => item.type === 'enum',
      )
      expect(enumItem).toBeDefined()
      expect(enumItem?.name).toBe('Direction')
      expect(enumItem?.variants).toBeDefined()
      expect(enumItem?.variants?.length).toBe(4)
    })

    it('should parse complex enums', async () => {
      const result = await parser.parseString(TEST_FIXTURES.COMPLEX_ENUM)

      expect(result.success).toBe(true)
      expect(result.crate?.rootModule.items.length).toBeGreaterThan(0)

      const enumItem = result.crate?.rootModule.items.find(
        (item) => item.type === 'enum',
      )
      expect(enumItem).toBeDefined()
      expect(enumItem?.name).toBe('Message')
      expect(enumItem?.visibility).toBe('pub')
      expect(enumItem?.variants).toBeDefined()
      expect(enumItem?.variants?.length).toBe(4)
    })
  })

  describe('parsing traits', () => {
    it('should parse trait definitions', async () => {
      const result = await parser.parseString(TEST_FIXTURES.TRAIT_DEFINITION)

      expect(result.success).toBe(true)
      expect(result.crate?.rootModule.items.length).toBeGreaterThan(0)

      const trait = result.crate?.rootModule.items.find(
        (item) => item.type === 'trait',
      )
      expect(trait).toBeDefined()
      expect(trait?.name).toBe('Draw')
      expect(trait?.visibility).toBe('pub')
    })
  })

  describe('parsing impl blocks', () => {
    it('should parse impl blocks', async () => {
      const result = await parser.parseString(TEST_FIXTURES.IMPL_BLOCK)

      expect(result.success).toBe(true)
      expect(result.crate?.rootModule.items.length).toBeGreaterThan(0)

      const impl = result.crate?.rootModule.items.find(
        (item) => item.type === 'impl',
      )
      expect(impl).toBeDefined()
      expect(impl?.implType).toBe('Point')
      expect(impl?.associatedItems).toBeDefined()
      expect(impl?.associatedItems?.length).toBeGreaterThan(0)
    })

    it('should parse trait implementations', async () => {
      const result = await parser.parseString(TEST_FIXTURES.TRAIT_IMPL)

      expect(result.success).toBe(true)
      expect(result.crate?.rootModule.items.length).toBeGreaterThan(0)

      const impl = result.crate?.rootModule.items.find(
        (item) => item.type === 'impl',
      )
      expect(impl).toBeDefined()
      expect(impl?.implType).toBe('Point')
      expect(impl?.traitName).toBe('Draw')
    })
  })

  describe('parsing modules', () => {
    it('should parse module definitions', async () => {
      const result = await parser.parseString(TEST_FIXTURES.MODULE_DEFINITION)

      expect(result.success).toBe(true)
      expect(result.crate?.rootModule.items.length).toBeGreaterThan(0)

      const module = result.crate?.rootModule.items.find(
        (item) => item.type === 'mod',
      )
      expect(module).toBeDefined()
      expect(module?.name).toBe('geometry')
      expect(module?.visibility).toBe('pub')
    })
  })

  describe('parsing use statements', () => {
    it('should parse use statements', async () => {
      const result = await parser.parseString(TEST_FIXTURES.USE_STATEMENTS)

      expect(result.success).toBe(true)
      expect(result.crate?.rootModule.items.length).toBeGreaterThan(0)

      const uses =
        result.crate?.rootModule.items.filter((item) => item.type === 'use') ||
        []
      expect(uses.length).toBeGreaterThan(0)
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

      // Some syntax errors might still parse partially
      expect(result).toBeDefined()
      expect(result.parseTime).toBeGreaterThan(0)
    })

    it('should handle empty input', async () => {
      const result = await parser.parseString('')

      expect(result.success).toBe(true)
      expect(result.crate?.rootModule.items).toHaveLength(0)
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

  describe('source location tracking', () => {
    it('should provide accurate source locations', async () => {
      const result = await parser.parseString(TEST_FIXTURES.SIMPLE_FUNCTION)

      expect(result.success).toBe(true)

      const func = result.crate?.rootModule.items.find(
        (item) => item.type === 'function',
      )
      expect(func?.location).toBeDefined()
      expect(func?.location.startLine).toBeGreaterThan(0)
      expect(func?.location.endLine).toBeGreaterThan(
        func?.location.startLine || 0,
      )
      expect(func?.location.startColumn).toBeGreaterThan(0)
      expect(func?.location.startByte).toBeGreaterThanOrEqual(0)
      expect(func?.location.endByte).toBeGreaterThan(
        func?.location.startByte || 0,
      )
    })
  })
})

describe('parseRustCode utility function', () => {
  it('should parse code and dispose parser automatically', async () => {
    const result = await parseRustCode(TEST_FIXTURES.SIMPLE_FUNCTION)

    expect(result.success).toBe(true)
    expect(result.crate?.rootModule.items.length).toBeGreaterThan(0)

    const func = result.crate?.rootModule.items.find(
      (item) => item.type === 'function',
    )
    expect(func?.name).toBe('greet')
  })

  it('should handle multiple rapid parsing calls', async () => {
    const promises = Array.from({ length: 5 }, (_, i) =>
      parseRustCode(`fn test_${i}() { println!("test"); }`),
    )

    const results = await Promise.all(promises)

    results.forEach((result, i) => {
      expect(result.success).toBe(true)
      const func = result.crate?.rootModule.items.find(
        (item) => item.type === 'function',
      )
      expect(func?.name).toBe(`test_${i}`)
    })
  })
})
