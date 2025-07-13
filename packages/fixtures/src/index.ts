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
    parseOutput: {
      'src/lib.rs': () => readFixtureJson<ParseResponse>('crates/rudy-parser/rudy-parser-0.4.0-parsed/src/lib.rs.json'),
      'src/expressions.rs': () => readFixtureJson<ParseResponse>('crates/rudy-parser/rudy-parser-0.4.0-parsed/src/expressions.rs.json'),
      'src/types.rs': () => readFixtureJson<ParseResponse>('crates/rudy-parser/rudy-parser-0.4.0-parsed/src/types.rs.json'),
    },
    metadata: {
      name: 'rudy-parser',
      version: '0.4.0',
      description: 'Test fixture for rudy-parser crate'
    }
  },
  serde: {
    tarball: () => readFixtureFile('crates/serde/tarball.tar.gz'),
    parseOutput: {
      'src/lib.rs': () => readFixtureJson<ParseResponse>('crates/serde/serde-1.0.219-parsed/src/lib.rs.json'),
      'src/de/mod.rs': () => readFixtureJson<ParseResponse>('crates/serde/serde-1.0.219-parsed/src/de/mod.rs.json'),
      'src/ser/mod.rs': () => readFixtureJson<ParseResponse>('crates/serde/serde-1.0.219-parsed/src/ser/mod.rs.json'),
    },
    metadata: {
      name: 'serde',
      version: '1.0.219',
      description: 'Test fixture for serde crate'
    }
  }
}

// Test utilities
export class FixtureHelper {
  static mockRustParserResponse(filePath: string): ParseResponse {
    // Simple mapping based on file path patterns
    if (filePath.includes('rudy-parser') || filePath.includes('rudy')) {
      if (filePath.includes('lib.rs')) {
        return fixtures.rudyParser.parseOutput['src/lib.rs']()
      }
      if (filePath.includes('expressions.rs')) {
        return fixtures.rudyParser.parseOutput['src/expressions.rs']()
      }
      if (filePath.includes('types.rs')) {
        return fixtures.rudyParser.parseOutput['src/types.rs']()
      }
      // Default to lib.rs for rudy-parser
      return fixtures.rudyParser.parseOutput['src/lib.rs']()
    }
    
    if (filePath.includes('serde')) {
      if (filePath.includes('lib.rs')) {
        return fixtures.serde.parseOutput['src/lib.rs']()
      }
      if (filePath.includes('de/mod.rs')) {
        return fixtures.serde.parseOutput['src/de/mod.rs']()
      }
      if (filePath.includes('ser/mod.rs')) {
        return fixtures.serde.parseOutput['src/ser/mod.rs']()
      }
      // Default to lib.rs for serde
      return fixtures.serde.parseOutput['src/lib.rs']()
    }
    
    // Fallback - return rudy-parser lib.rs
    return fixtures.rudyParser.parseOutput['src/lib.rs']()
  }

  static createMockRustParser() {
    return {
      parse_rust_code: vi.fn().mockImplementation((input: { code: string }) => {
        // Use content-based heuristics to determine which fixture to return
        if (input.code.includes('pub mod expressions')) {
          return fixtures.rudyParser.parseOutput['src/lib.rs']()
        }
        if (input.code.includes('Expression')) {
          return fixtures.rudyParser.parseOutput['src/expressions.rs']()
        }
        if (input.code.includes('Type')) {
          return fixtures.rudyParser.parseOutput['src/types.rs']()
        }
        if (input.code.includes('serde') || input.code.includes('Serialize')) {
          return fixtures.serde.parseOutput['src/lib.rs']()
        }
        
        // Default fallback
        return fixtures.rudyParser.parseOutput['src/lib.rs']()
      })
    }
  }
}

export * from './types'