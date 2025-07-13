export interface CrateFixture {
  name: string
  version: string
  description: string
}

export interface MockRustParser {
  parse_rust_code: (input: { code: string; option?: any }) => any
}