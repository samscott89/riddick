interface RustParser extends Fetcher {
  parse_rust_code(input: { code: string; option?: any }): Promise<ParseResponse>
}

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Env {
    DB: D1Database
    CRATE_BUCKET: R2Bucket
    RUST_PARSER: RustParser
    CRATE_WORKFLOW: Workflow
    AI: Ai
  }
}
