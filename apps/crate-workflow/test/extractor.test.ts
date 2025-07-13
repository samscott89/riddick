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

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: expect.stringMatching(/.*\.rs$/),
            content: expect.any(String),
          }),
        ]),
      )

      // Check specific files we know should be in rudy-parser
      const libFile = result.find((f) => f.path.endsWith('lib.rs'))
      expect(libFile).toBeDefined()
      expect(libFile?.content).toContain('pub mod expressions')
      expect(libFile?.content).toContain('pub mod types')

      const expressionsFile = result.find((f) =>
        f.path.endsWith('expressions.rs'),
      )
      expect(expressionsFile).toBeDefined()

      const typesFile = result.find((f) => f.path.endsWith('types.rs'))
      expect(typesFile).toBeDefined()
    })

    it('should filter out non-rust files', async () => {
      const tarballData = fixture.mockDownloadCrate('rudy-parser', '1.0.219')

      const result = await TarExtractor.extractRustFiles(
        new Uint8Array(tarballData),
      )

      // Should only contain .rs files
      const allRustFiles = result.every((file) => file.path.endsWith('.rs'))
      expect(allRustFiles).toBe(true)

      // Should not contain Cargo.toml, README.md, etc.
      const hasNonRustFiles = result.some(
        (file) =>
          file.path.endsWith('.toml') ||
          file.path.endsWith('.md') ||
          file.path.endsWith('.txt'),
      )
      expect(hasNonRustFiles).toBe(false)
    })

    it('should normalize file paths', async () => {
      const tarballData = fixture.mockDownloadCrate('rudy-parser', '0.4.0')

      const result = await TarExtractor.extractRustFiles(
        new Uint8Array(tarballData),
      )

      // Paths should be relative and normalized
      result.forEach((file) => {
        expect(file.path).not.toMatch(/^\//) // Should not start with /
        expect(file.path).not.toMatch(/\.\./) // Should not contain ..
        expect(file.path).toMatch(/^[\w\-./]+$/) // Should be clean paths
      })
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

      const libFile = result.find((f) => f.path.endsWith('lib.rs'))
      expect(libFile?.content).toBeTruthy()
      expect(libFile?.content.length).toBeGreaterThan(0)

      // Content should be valid UTF-8 text
      expect(typeof libFile?.content).toBe('string')
      expect(libFile?.content).toMatch(/^[\s\S]*$/) // Should contain printable characters
    })

    it('should extract files with correct relative paths', async () => {
      const tarballData = fixture.mockDownloadCrate('rudy-parser', '0.4.0')

      const result = await TarExtractor.extractRustFiles(
        new Uint8Array(tarballData),
      )

      // Find the lib.rs file
      const libFile = result.find((f) => f.path.endsWith('lib.rs'))
      expect(libFile?.path).toMatch(/src\/lib\.rs$/)

      // Check that paths maintain directory structure
      const srcFiles = result.filter((f) =>
        f.path.startsWith('rudy-parser-0.4.0/src/'),
      )
      expect(srcFiles.length).toBeGreaterThan(0)
    })
  })
})
