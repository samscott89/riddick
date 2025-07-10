# Rust Parser Foundation

A comprehensive Rust parser implementation using Tree-sitter WASM, designed for extracting structured information from Rust source code and deployable to Cloudflare Workers.

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
- **Comprehensive Testing**: 139+ tests covering core functionality

## 📦 Installation

```bash
npm install web-tree-sitter
```

The parser uses Tree-sitter WASM bindings that work in both Node.js and Cloudflare Workers environments.

## 🚀 Usage

### Basic Parsing

```typescript
import { parseRustCodeWasm } from './parser'

const rustCode = `
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}
`

// For Cloudflare Workers
const result = await parseRustCodeWasm(rustCode)

// For Node.js (with explicit WASM paths)
const result = await parseRustCodeWasm(
  rustCode, 
  {}, 
  './public/wasm/tree-sitter.wasm',
  './public/wasm/tree-sitter-rust.wasm'
)

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
import { createWasmRustParser } from './parser'

const parser = createWasmRustParser({
    includeComments: true,
    includeDocComments: true,
    includePrivateItems: false,
    maxDepth: 10,
    timeout: 5000,
})

// Initialize with WASM paths
await parser.initialize(
  './public/wasm/tree-sitter.wasm',
  './public/wasm/tree-sitter-rust.wasm'
)

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

#### 2. Parser Engine (`wasm-parser.ts`)
- **WasmRustParser**: Main parser class with Tree-sitter WASM integration
- **Tree-sitter Queries**: Sophisticated pattern matching for Rust constructs
- **Error Recovery**: Graceful handling of malformed code
- **Resource Management**: Proper parser lifecycle management
- **Cloudflare Workers Support**: Runs in Workers runtime environment

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
  Tree-sitter
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
import { WasmRustParser } from './parser'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { code } = await request.json()
    
    const parser = new WasmRustParser()
    
    try {
      // WASM files are bundled with the Worker
      await parser.initialize()
      
      const result = await parser.parseString(code, 'worker-crate')
      
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error) {
      return new Response(`Parse error: ${error}`, { status: 400 })
    } finally {
      parser.dispose()
    }
  },
}
```

**Setup for Cloudflare Workers:**

1. Copy WASM files to public directory
2. Configure `wrangler.toml` to upload WASM assets
3. Deploy with `wrangler deploy`

See `examples/` directory for complete deployment instructions.

### Performance Considerations

- **Memory Usage**: Large files may require streaming or chunking
- **Timeout Handling**: Set appropriate timeouts for your use case
- **Resource Cleanup**: Always call `dispose()` to prevent memory leaks
- **Parser Reuse**: Consider reusing parser instances for better performance

## 🐛 Troubleshooting

### Common Issues

1. **Parse Timeouts**
   ```
   Parser timed out after 5000ms
   ```
   - Increase timeout in parser options
   - Consider breaking large files into smaller chunks
   - Use streaming parsing for very large codebases

2. **Memory Issues**
   ```
   Insufficient memory to parse the code
   ```
   - Implement chunked parsing for large files
   - Ensure proper resource disposal
   - Monitor memory limits

3. **TypeScript Compilation Errors**
   ```
   Type errors in parser interface
   ```
   - Ensure tree-sitter and tree-sitter-rust are properly installed
   - Check TypeScript version compatibility

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
- [Rust Language Reference](https://doc.rust-lang.org/reference/)

## 📄 License

This parser implementation is part of the Riddick project and follows the same licensing terms.