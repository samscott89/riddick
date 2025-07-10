# Rust Parser Foundation

A comprehensive Rust parser implementation using Tree-sitter with WASM bindings, designed for Cloudflare Workers environments.

## 🚀 Features

### Core Parsing Capabilities
- **Complete AST Extraction**: Parses Rust source code into structured TypeScript objects
- **Type-Safe Interfaces**: Full TypeScript support with comprehensive type definitions
- **Source Location Tracking**: Preserves line, column, and byte position information
- **Error Recovery**: Handles syntax errors gracefully with detailed error reporting

### Supported Rust Constructs
- ✅ Functions (including async, generic, and associated functions)
- ✅ Structs (unit, tuple, and named field structs)
- ✅ Enums (including complex variants with fields)
- ✅ Traits and trait implementations
- ✅ Impl blocks (inherent and trait implementations)
- ✅ Modules and submodules
- ✅ Use statements and imports
- ✅ Constants and static variables
- ✅ Type aliases
- ✅ Macro definitions
- ✅ Attributes and derive macros
- ✅ Generic parameters and where clauses
- ✅ Visibility modifiers (pub, pub(crate), etc.)

### Advanced Features
- **Tree-sitter Query System**: Uses sophisticated query patterns for precise extraction
- **Batch Processing**: Efficient parsing of large codebases
- **Resource Management**: Proper cleanup and disposal of parser resources
- **Performance Monitoring**: Built-in timing and performance metrics
- **Configurable Options**: Customizable parsing behavior
- **Comprehensive Testing**: 162+ tests covering all functionality

## 📦 Installation

```bash
npm install web-tree-sitter
```

## 🔧 Setup

### 1. Download Tree-sitter WASM Files

You'll need the Tree-sitter WASM files for your Cloudflare Workers deployment:

```bash
# Download the core Tree-sitter WASM
curl -L https://github.com/tree-sitter/tree-sitter/releases/latest/download/tree-sitter.wasm -o public/tree-sitter.wasm

# Download the Rust grammar WASM
curl -L https://github.com/tree-sitter/tree-sitter-rust/releases/latest/download/tree-sitter-rust.wasm -o public/tree-sitter-rust.wasm
```

### 2. Cloudflare Workers Configuration

Add the WASM files to your `wrangler.toml`:

```toml
[[rules]]
type = "Data"
globs = ["**/*.wasm"]
```

## 🚀 Usage

### Basic Parsing

```typescript
import { parseRustCode } from './parser'

const rustCode = `
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}
`

const result = await parseRustCode(rustCode)

if (result.success) {
    console.log('Parsed successfully!')
    console.log('Functions found:', result.crate?.rootModule.items.length)
    
    const func = result.crate?.rootModule.items[0]
    console.log('Function name:', func?.name)
    console.log('Parameters:', func?.parameters)
} else {
    console.error('Parse errors:', result.errors)
}
```

### Advanced Usage with Custom Options

```typescript
import { createRustParser } from './parser'

const parser = createRustParser({
    includeComments: true,
    includeDocComments: true,
    includePrivateItems: false,
    maxDepth: 10,
    timeout: 5000,
})

await parser.initialize('/path/to/tree-sitter-rust.wasm')

try {
    const result = await parser.parseString(rustCode, 'my-crate')
    
    // Process the parsed crate
    for (const item of result.crate?.rootModule.items || []) {
        switch (item.type) {
            case 'function':
                console.log(`Function: ${item.name}`)
                console.log(`Parameters: ${item.parameters?.length || 0}`)
                break
            case 'struct':
                console.log(`Struct: ${item.name}`)
                console.log(`Fields: ${item.fields?.length || 0}`)
                break
            case 'enum':
                console.log(`Enum: ${item.name}`)
                console.log(`Variants: ${item.variants?.length || 0}`)
                break
        }
    }
} finally {
    parser.dispose()
}
```

### Error Handling

```typescript
import { ParseErrorHandler, validateRustCode } from './parser'

// Pre-validate Rust code
const validationErrors = validateRustCode(rustCode)
if (validationErrors.length > 0) {
    console.log('Validation issues found:')
    validationErrors.forEach(error => {
        console.log(`${error.severity}: ${error.message}`)
    })
}

// Handle parse errors
const result = await parseRustCode(rustCode)
if (!result.success) {
    const errorHandler = new ParseErrorHandler()
    result.errors.forEach(error => {
        errorHandler.addError(error.message, error.location, error.severity)
    })
    
    console.log('Formatted errors:')
    console.log(errorHandler.formatAllErrors())
}
```

## 🏗️ Architecture

### Core Components

#### 1. Type System (`types.ts`)
- **ParsedCrate**: Top-level container for parsed Rust code
- **ParsedModule**: Represents Rust modules and submodules
- **ParsedItem**: Individual code items (functions, structs, etc.)
- **SourceLocation**: Precise location tracking in source code

#### 2. Parser Engine (`rust-parser.ts`)
- **RustParser**: Main parser class with Tree-sitter integration
- **Tree-sitter Queries**: Sophisticated pattern matching for Rust constructs
- **Error Recovery**: Graceful handling of malformed code
- **Resource Management**: Proper WASM module lifecycle

#### 3. Query System (`queries.ts`)
- Pre-built Tree-sitter queries for all Rust constructs
- Optimized patterns for performance
- Comprehensive coverage of Rust syntax

#### 4. Error Handling (`error-handler.ts`)
- **ParseErrorHandler**: Centralized error management
- **ValidationError**: Custom error types with location info
- **Pre-validation**: Catch common issues before parsing

### Data Flow

```
Rust Source Code
       ↓
   Validation
       ↓
  Tree-sitter WASM
       ↓
   Query System
       ↓
  Type-safe AST
       ↓
   ParseResult
```

## 🔍 Type Definitions

### ParsedItem Interface

```typescript
interface ParsedItem {
  type: ItemType
  name: string
  sourceCode: string
  location: SourceLocation
  visibility?: 'pub' | 'pub(crate)' | 'pub(super)' | 'pub(in path)' | 'private'
  attributes?: string[]
  genericParameters?: string[]
  
  // Type-specific fields
  parameters?: FunctionParameter[]      // Functions
  returnType?: string                   // Functions
  fields?: StructField[]               // Structs
  variants?: EnumVariant[]             // Enums
  traitName?: string                   // Trait impls
  implType?: string                    // Impl blocks
  associatedItems?: ParsedItem[]       // Impl blocks
}
```

### Parser Options

```typescript
interface ParserOptions {
  includeComments?: boolean       // Include comment nodes
  includeDocComments?: boolean    // Include documentation comments
  includePrivateItems?: boolean   // Include private items
  maxDepth?: number              // Maximum parsing depth
  timeout?: number               // Parsing timeout in ms
}
```

## 🧪 Testing

The parser includes comprehensive test coverage:

```bash
# Run all tests
npm test

# Run parser-specific tests
npm test src/parser

# Run with coverage
npm test -- --coverage
```

### Test Categories

- **Unit Tests**: Individual component functionality
- **Integration Tests**: End-to-end parsing workflows
- **Error Handling Tests**: Error recovery and reporting
- **Performance Tests**: Large file handling and timing
- **Fixtures**: Real-world Rust code examples

## 🎯 Production Deployment

### Cloudflare Workers

```typescript
// worker.ts
import { parseRustCode } from './parser'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const rustCode = await request.text()
    
    try {
      const result = await parseRustCode(rustCode, {
        timeout: 10000, // 10 second timeout
        includeComments: false,
      })
      
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error) {
      return new Response(`Parse error: ${error}`, { status: 400 })
    }
  },
}
```

### Performance Considerations

- **WASM Loading**: Tree-sitter WASM files are ~1MB, consider CDN caching
- **Memory Usage**: Large files may require streaming or chunking
- **Timeout Handling**: Set appropriate timeouts for your use case
- **Resource Cleanup**: Always call `dispose()` to prevent memory leaks

## 🐛 Troubleshooting

### Common Issues

1. **WASM Loading Errors**
   ```
   Failed to initialize Rust parser: WASM load failed
   ```
   - Ensure WASM files are accessible at the specified paths
   - Check CORS headers for WASM files
   - Verify Cloudflare Workers WASM configuration

2. **Parse Timeouts**
   ```
   Parser timed out after 5000ms
   ```
   - Increase timeout in parser options
   - Consider breaking large files into smaller chunks
   - Use streaming parsing for very large codebases

3. **Memory Issues**
   ```
   Insufficient memory to parse the code
   ```
   - Implement chunked parsing for large files
   - Ensure proper resource disposal
   - Monitor Workers memory limits

### Debug Mode

Enable detailed logging:

```typescript
const parser = createRustParser({
  timeout: 30000,
  maxDepth: 100,
})

// Add custom error handling
try {
  const result = await parser.parseString(code)
  console.log(`Parse time: ${result.parseTime}ms`)
  console.log(`Items found: ${result.crate?.rootModule.items.length}`)
} catch (error) {
  console.error('Detailed error:', error)
}
```

## 🤝 Contributing

1. **Add New Rust Constructs**: Extend the query system and type definitions
2. **Improve Error Recovery**: Enhance error handling for edge cases  
3. **Performance Optimization**: Optimize query patterns and memory usage
4. **Test Coverage**: Add more real-world Rust code examples

## 📚 Resources

- [Tree-sitter Documentation](https://tree-sitter.github.io/tree-sitter/)
- [Tree-sitter Rust Grammar](https://github.com/tree-sitter/tree-sitter-rust)
- [Cloudflare Workers WASM](https://developers.cloudflare.com/workers/runtime-apis/webassembly/)
- [Rust Language Reference](https://doc.rust-lang.org/reference/)

## 📄 License

This parser implementation is part of the Riddick project and follows the same licensing terms.