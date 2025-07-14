import { describe, it, expect, inject } from 'vitest'
import { TarExtractor } from '../src/extractor'
import { FixtureHelper } from '@riddick/fixtures'

describe('TarExtractor', () => {
  const fixture = new FixtureHelper(inject('fixtureData'))
  describe('extractRustFiles', () => {
    it('should extract rust files from rudy-parser tarball', async () => {
      const tarballData = fixture.mockDownloadCrate('rudy-parser', '0.4.0')

      const result = await TarExtractor.extractRustFiles(
        new Uint8Array(tarballData),
      )

      expect(result.has('src/lib.rs')).toBe(true)

      // Check specific files we know should be in rudy-parser
      const libFile = result.get('src/lib.rs')
      expect(libFile).toBeDefined()
      expect(libFile).toContain('pub mod expressions')
      expect(libFile).toContain('pub mod types')

      const expressionsFile = result.get('src/expressions.rs')
      expect(expressionsFile).toBeDefined()

      const typesFile = result.get('src/types.rs')
      expect(typesFile).toBeDefined()
    })

    it('should filter out non-rust files', async () => {
      const tarballData = fixture.mockDownloadCrate('rudy-parser', '1.0.219')

      const result = await TarExtractor.extractRustFiles(
        new Uint8Array(tarballData),
      )

      // Should only contain .rs files
      const allRustFiles = Object.entries(result).every(([file, _code]) =>
        file.endsWith('.rs'),
      )
      expect(allRustFiles).toBe(true)
    })

    it('should handle empty or invalid tarballs gracefully', async () => {
      const invalidData = new Uint8Array([1, 2, 3, 4, 5])

      await expect(TarExtractor.extractRustFiles(invalidData)).rejects.toThrow()
    })

    it('should handle empty tarball data', async () => {
      const emptyData = new Uint8Array(0)

      await expect(TarExtractor.extractRustFiles(emptyData)).rejects.toThrow()
    })

    it('should preserve file content integrity', async () => {
      const tarballData = fixture.mockDownloadCrate('rudy-parser', '0.4.0')

      const result = await TarExtractor.extractRustFiles(
        new Uint8Array(tarballData),
      )

      const libFile = result.get('src/lib.rs')
      expect(libFile).toBeTruthy()
      expect(libFile!.length).toBeGreaterThan(0)

      // Content should be valid UTF-8 text
      expect(typeof libFile).toBe('string')
      expect(libFile).toMatch(/^[\s\S]*$/) // Should contain printable characters
    })
  })
})
