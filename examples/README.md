# Cloudflare Workers Examples

This directory contains examples of how to use the WASM Rust parser in Cloudflare Workers.

## Files

- `cloudflare-worker.ts` - Example Worker implementation
- `wrangler.toml` - Example deployment configuration
- `README.md` - This file

## Setup

1. **Install dependencies:**
   ```bash
   npm install web-tree-sitter
   ```

2. **Copy WASM files to public directory:**
   ```bash
   mkdir -p public/wasm
   cp node_modules/web-tree-sitter/tree-sitter.wasm public/wasm/
   cp node_modules/tree-sitter-rust/tree-sitter-rust.wasm public/wasm/
   ```

3. **Build the Worker:**
   ```bash
   # Add this script to package.json:
   # "build:worker": "esbuild examples/cloudflare-worker.ts --bundle --format=esm --outfile=dist/cloudflare-worker.js --external:web-tree-sitter"
   npm run build:worker
   ```

4. **Deploy to Cloudflare Workers:**
   ```bash
   wrangler deploy
   ```

## Usage

The Worker provides a single POST endpoint `/parse` that accepts JSON with a `code` field containing Rust source code.

### Example Request

```bash
curl -X POST https://your-worker.yourname.workers.dev/parse \
  -H "Content-Type: application/json" \
  -d '{
    "code": "fn main() { println!(\"Hello, world!\"); }"
  }'
```

### Example Response

```json
{
  "success": true,
  "parseTime": 15,
  "crate": {
    "name": "unnamed",
    "rootModule": {
      "name": "root",
      "path": "main.rs",
      "items": [
        {
          "type": "function",
          "name": "main",
          "visibility": "private",
          "parameters": [],
          "location": {
            "startLine": 1,
            "startColumn": 1,
            "endLine": 1,
            "endColumn": 45
          }
        }
      ]
    }
  },
  "errors": []
}
```

## Performance Considerations

- **Cold starts**: WASM initialization adds ~50-100ms to cold starts
- **Memory usage**: Tree-sitter WASM uses more memory than native
- **Parse time**: Expect 2-5x slower parsing compared to native Node.js
- **Concurrent parsing**: Each request creates a new parser instance

## Optimization Tips

1. **Cache parser instance** (if using in a service worker context)
2. **Limit input size** to prevent timeout/memory issues
3. **Use streaming** for very large files
4. **Enable compression** for responses
5. **Consider using KV storage** for caching frequently parsed files

## Limitations

- **File size**: Recommend max 1MB input size
- **Parse time**: Complex files may take several seconds
- **Memory**: Large ASTs consume significant memory
- **Concurrent requests**: Each parser instance is single-threaded

## Advanced Usage

### With KV Caching

```typescript
// Cache parsed results in KV
const cacheKey = `parsed:${hashCode(code)}`
const cached = await env.CACHE.get(cacheKey, 'json')
if (cached) {
  return new Response(JSON.stringify(cached))
}

// Parse and cache result
const result = await parser.parseString(code)
await env.CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: 3600 })
```

### With D1 Database Storage

```typescript
// Store parsed results in D1
await env.DB.prepare(`
  INSERT INTO parsed_files (hash, result, created_at) 
  VALUES (?, ?, ?)
`).bind(hashCode(code), JSON.stringify(result), Date.now()).run()
```

### Streaming Large Files

```typescript
// Handle large files with streaming
const reader = request.body?.getReader()
let code = ''
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  code += new TextDecoder().decode(value)
}
```