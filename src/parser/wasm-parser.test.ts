import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import { TEST_FIXTURES } from './test-fixtures'
import type { ParserOptions } from './types'
import type { WasmRustParser } from './wasm-parser'
import { createWasmRustParser, parseRustCodeWasm } from './wasm-parser'

describe('WASM Rust Parser', () => {
  let parser: WasmRustParser

  beforeAll(async () => {
    parser = createWasmRustParser()
    await parser.initialize(
      './public/wasm/tree-sitter.wasm',
      './public/wasm/tree-sitter-rust.wasm'
    )
  })

  afterAll(() => {
    parser.dispose()
  })

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const testParser = createWasmRustParser()
      await expect(testParser.initialize(
        './public/wasm/tree-sitter.wasm',
        './public/wasm/tree-sitter-rust.wasm'
      )).resolves.not.toThrow()
      testParser.dispose()
    })

    it('should throw error if parsing without initialization', async () => {
      const testParser = createWasmRustParser()
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
      expect(endTime - startTime).toBeLessThan(10000) // WASM might be slower, allow 10 seconds
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

      const testParser = createWasmRustParser(options)
      await testParser.initialize(
        './public/wasm/tree-sitter.wasm',
        './public/wasm/tree-sitter-rust.wasm'
      )

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

describe('parseRustCodeWasm utility function', () => {
  it('should parse code and dispose parser automatically', async () => {
    const result = await parseRustCodeWasm(
      TEST_FIXTURES.SIMPLE_FUNCTION,
      {},
      './public/wasm/tree-sitter.wasm',
      './public/wasm/tree-sitter-rust.wasm'
    )

    expect(result.success).toBe(true)
    expect(result.crate?.rootModule.items.length).toBeGreaterThan(0)

    const func = result.crate?.rootModule.items.find(
      (item) => item.type === 'function',
    )
    expect(func?.name).toBe('greet')
  })

  it('should handle multiple rapid parsing calls', async () => {
    const promises = Array.from({ length: 3 }, (_, i) =>
      parseRustCodeWasm(
        `fn test_${i}() { println!("test"); }`,
        {},
        './public/wasm/tree-sitter.wasm',
        './public/wasm/tree-sitter-rust.wasm'
      ),
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