import type { ParseResponse } from '@riddick/types'

export interface Fixture {
  tarball: string
  parseOutput: Record<string, ParseResponse>
  metadata: {
    name: string
    version: string
    description: string
  }
}

export type SupportedCrateName = 'rudy-parser'
export type FixtureData = Record<string, Fixture>

export async function getFixtureData(): Promise<FixtureData> {
  // import these dynamically -- these are only
  // callable in test context that support node
  // (i.e. not in wrangler tests)
  const { readFileSync } = await import('fs')
  const { join, dirname } = await import('path')
  const { fileURLToPath } = await import('url')
  const __filename = fileURLToPath(import.meta.url) // get the resolved path to the file
  const __dirname = dirname(__filename) // get the name of the directory

  console.log('Loading fixture data from:', __dirname)

  // Helper to read fixture files
  function readFixtureFile(path: string): Buffer {
    return readFileSync(join(__dirname, path))
  }

  function readFixtureBase64(path: string): string {
    const buffer = readFileSync(join(__dirname, path))
    return buffer.toString('base64')
  }

  function readFixtureJson<T>(path: string): T {
    const content = readFixtureFile(path).toString('utf-8')
    return JSON.parse(content)
  }

  const rudyParser = {
    tarball: readFixtureBase64('crates/rudy-parser/tarball.tar.gz'),
    parseOutput: {
      'src/lib.rs': readFixtureJson<ParseResponse>(
        'crates/rudy-parser/rudy-parser-0.4.0-parsed/src/lib.rs.json',
      ),
      'src/expressions.rs': readFixtureJson<ParseResponse>(
        'crates/rudy-parser/rudy-parser-0.4.0-parsed/src/expressions.rs.json',
      ),
      'src/types.rs': readFixtureJson<ParseResponse>(
        'crates/rudy-parser/rudy-parser-0.4.0-parsed/src/types.rs.json',
      ),
    },
    metadata: {
      name: 'rudy-parser',
      version: '0.4.0',
      description: 'Test fixture for rudy-parser crate',
    },
  }

  console.log('Loaded rudy-parser fixture:', rudyParser.metadata)

  // NOTE: attempting to return more fixtures seems to exceed limits
  // of how much data we can send to the cloudflare worker
  // since it appears as though the data gets sent as a HTTP header
  return {
    rudyParser,
  }
}

// Test utilities
export class FixtureHelper {
  fixtures: FixtureData
  constructor(fixtures: FixtureData) {
    this.fixtures = fixtures
  }

  mockDownloadCrate(crateName: SupportedCrateName, _version: string): Buffer {
    if (crateName === 'rudy-parser') {
      return Buffer.from(this.fixtures.rudyParser.tarball, 'base64')
    }
    throw new Error(`No fixture found for crate ${crateName}`)
  }

  createMockRustParser(vi: any, crateName: SupportedCrateName) {
    return vi
      .fn()
      .mockImplementation((input: { code: string; filePath: string }) => {
        const fileName = input.filePath
        if (crateName === 'rudy-parser') {
          if (fileName in this.fixtures.rudyParser.parseOutput) {
            return this.fixtures.rudyParser.parseOutput[fileName]
          } else {
            throw new Error(
              `No mock parser output for ${crateName} ${fileName}`,
            )
          }
        }
        throw new Error(`No mock parser output for ${crateName} ${fileName}`)
      })
  }
}
