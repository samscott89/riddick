import { readFileSync } from 'fs'
import { join } from 'path'
import type { ParseResponse } from '@riddick/types'

// Helper to read fixture files
function readFixtureFile(path: string): Buffer {
  return readFileSync(join(__dirname, path))
}

function readFixtureJson<T>(path: string): T {
  const content = readFixtureFile(path).toString('utf-8')
  return JSON.parse(content)
}

export const fixtures = {
  rudyParser: {
    tarball: () => readFixtureFile('crates/rudy-parser/tarball.tar.gz'),
    parseOutput: () => readFixtureJson<ParseResponse>('crates/rudy-parser/parsed-output.json'),
    metadata: {
      name: 'rudy-parser',
      version: '0.4.0',
      description: 'Test fixture for rudy-parser crate'
    }
  },
  serde: {
    tarball: () => readFixtureFile('crates/serde/tarball.tar.gz'),
    parseOutput: () => readFixtureJson<ParseResponse>('crates/serde/parsed-output.json'),
    metadata: {
      name: 'serde',
      version: '1.0.219',
      description: 'Test fixture for serde crate'
    }
  }
}

// Test utilities
export class FixtureHelper {
  static mockRustParserResponse(crateName: string): ParseResponse {
    switch (crateName) {
      case 'rudy-parser':
        return fixtures.rudyParser.parseOutput()
      case 'serde':
        return fixtures.serde.parseOutput()
      default:
        throw new Error(`No fixture available for crate: ${crateName}`)
    }
  }

  static createMockRustParser() {
    return {
      parse_rust_code: vi.fn().mockImplementation((input: { code: string }) => {
        // Simple heuristic to determine which fixture to return
        if (input.code.includes('rudy')) {
          return fixtures.rudyParser.parseOutput()
        }
        if (input.code.includes('serde')) {
          return fixtures.serde.parseOutput()
        }
        // Default to rudy-parser for other cases
        return fixtures.rudyParser.parseOutput()
      })
    }
  }
}

export * from './types'