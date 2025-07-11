import { describe, it, expect } from 'vitest'

import { parseRustCode } from './rust-wasm-parser'
import { TEST_FIXTURES } from './test-fixtures'
import type { ItemType } from './types'

describe('Parser Integration Tests', () => {
  describe('end-to-end parsing workflows', () => {
    it('should parse and extract complete crate information', async () => {
      const result = await parseRustCode(TEST_FIXTURES.COMPLETE_MODULE)

      expect(result.success).toBe(true)
      expect(result.crateInfo).toBeDefined()

      const crate = result.crateInfo!
      expect(crate.name).toBe('unnamed')
      expect(crate.modules).toHaveLength(1)
      expect(crate.rootModule).toStrictEqual(crate.modules[0])

      // Verify we have different types of items
      const itemTypes = new Set(crate.rootModule.items.map((item) => item.type))
      expect(itemTypes.has('struct' as ItemType)).toBe(true)
      expect(itemTypes.has('enum' as ItemType)).toBe(true)
      expect(itemTypes.has('trait' as ItemType)).toBe(true)
      expect(itemTypes.has('impl' as ItemType)).toBe(true)
      expect(itemTypes.has('mod' as ItemType)).toBe(true)
    })

    it('should preserve source code and location information', async () => {
      const sourceCode = TEST_FIXTURES.SIMPLE_FUNCTION
      const result = await parseRustCode(sourceCode)

      expect(result.success).toBe(true)
      expect(result.crateInfo?.rootModule.items).toHaveLength(1)

      const func = result.crateInfo!.rootModule.items[0]
      expect(func.sourceCode).toContain('fn greet')
      expect(func.sourceCode).toContain('format!')
      expect(func.location.startLine).toBeGreaterThan(0)
      expect(func.location.endLine).toBeGreaterThan(func.location.startLine)
    })

    it('should handle complex nested structures', async () => {
      const complexCode = `
        mod outer {
            pub struct OuterStruct {
                value: i32,
            }
            
            pub mod inner {
                use super::OuterStruct;
                
                pub struct InnerStruct {
                    outer: OuterStruct,
                }
                
                impl InnerStruct {
                    pub fn new(value: i32) -> Self {
                        InnerStruct {
                            outer: OuterStruct { value },
                        }
                    }
                }
            }
        }
      `

      const result = await parseRustCode(complexCode)
      expect(result.success).toBe(true)

      const items = result.crateInfo!.rootModule.items
      const modules = items.filter((item) => item.type === 'mod')
      expect(modules).toHaveLength(1)
      expect(modules[0].name).toBe('outer')
    })

    it('should extract function parameters correctly', async () => {
      const functionCode = `
        fn complex_function(
            self,
            mut x: i32,
            y: &str,
            z: &mut Vec<String>,
            callback: Box<dyn Fn(i32) -> String>,
        ) -> Result<String, Box<dyn std::error::Error>> {
            Ok(format!("Result: {}", x))
        }
      `

      const result = await parseRustCode(functionCode)
      expect(result.success).toBe(true)

      const func = result.crateInfo!.rootModule.items[0]
      expect(func.parameters).toBeDefined()
      expect(func.parameters!.length).toBeGreaterThan(3)

      const selfParam = func.parameters!.find((p) => p.isSelf)
      expect(selfParam).toBeDefined()
      expect(selfParam!.name).toBe('self')
    })

    it('should extract struct fields with visibility', async () => {
      const structCode = `
        pub struct MixedVisibility {
            pub public_field: String,
            pub(crate) crate_field: i32,
            pub(super) super_field: bool,
            private_field: f64,
        }
      `

      const result = await parseRustCode(structCode)
      expect(result.success).toBe(true)

      const struct = result.crateInfo!.rootModule.items[0]
      expect(struct.fields).toBeDefined()
      expect(struct.fields!.length).toBe(4)

      const publicField = struct.fields!.find((f) => f.name === 'public_field')
      expect(publicField?.visibility).toBe('pub')

      const privateField = struct.fields!.find(
        (f) => f.name === 'private_field',
      )
      expect(privateField?.visibility).toBe('private')
    })

    it('should handle generic constraints and where clauses', async () => {
      const genericCode = `
        struct GenericStruct<T, U>
        where
            T: Clone + Debug + Send + Sync,
            U: Serialize + DeserializeOwned,
        {
            data: T,
            metadata: U,
        }
        
        impl<T, U> GenericStruct<T, U>
        where
            T: Clone + Debug + Send + Sync,
            U: Serialize + DeserializeOwned,
        {
            fn new(data: T, metadata: U) -> Self {
                GenericStruct { data, metadata }
            }
        }
      `

      const result = await parseRustCode(genericCode)
      expect(result.success).toBe(true)

      const items = result.crateInfo!.rootModule.items
      expect(items).toHaveLength(2)

      const struct = items.find((item) => item.type === 'struct')
      const impl = items.find((item) => item.type === 'impl')

      expect(struct?.genericParameters || []).toContain('T')
      expect(struct?.genericParameters || []).toContain('U')
      expect(impl?.genericParameters || []).toContain('T')
      expect(impl?.genericParameters || []).toContain('U')
    })

    it('should extract enum variants with different types', async () => {
      const enumCode = `
        #[derive(Debug, PartialEq)]
        pub enum ComplexEnum {
            Unit,
            Tuple(String, i32, bool),
            Struct { 
                name: String, 
                value: i32 
            },
            WithDiscriminant = 42,
        }
      `

      const result = await parseRustCode(enumCode)
      expect(result.success).toBe(true)

      const enumItem = result.crateInfo!.rootModule.items[0]
      expect(enumItem.variants).toBeDefined()
      expect(enumItem.variants!.length).toBe(4)

      const variants = enumItem.variants!
      expect(variants.map((v) => v.name)).toContain('Unit')
      expect(variants.map((v) => v.name)).toContain('Tuple')
      expect(variants.map((v) => v.name)).toContain('Struct')
      expect(variants.map((v) => v.name)).toContain('WithDiscriminant')
    })

    it('should handle trait implementations with associated types', async () => {
      const traitCode = `
        trait MyTrait {
            type Output;
            type Error;
            
            fn process(&self, input: Self::Output) -> Result<Self::Output, Self::Error>;
        }
        
        impl MyTrait for String {
            type Output = String;
            type Error = std::fmt::Error;
            
            fn process(&self, input: Self::Output) -> Result<Self::Output, Self::Error> {
                Ok(format!("{}: {}", self, input))
            }
        }
      `

      const result = await parseRustCode(traitCode)
      expect(result.success).toBe(true)

      const items = result.crateInfo!.rootModule.items
      expect(items).toHaveLength(2)

      const trait = items.find((item) => item.type === 'trait')
      const impl = items.find((item) => item.type === 'impl')

      expect(trait?.name).toBe('MyTrait')
      expect(impl?.traitName).toBe('MyTrait')
      expect(impl?.implType).toBe('String')
    })
  })

  describe('error recovery and reporting', () => {
    it('should provide detailed error information for syntax errors', async () => {
      const brokenCode = `
        fn broken_function() {
            let x = 5
            println!("Missing semicolon");
            // Missing closing brace
      `

      const result = await parseRustCode(brokenCode)
      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)

      const errors = result.errors
      expect(errors.every((e) => e.message.length > 0)).toBe(true)
    })

    it('should handle partial parsing of valid sections', async () => {
      const mixedCode = `
        fn valid_function() {
            println!("This is valid");
        }
        
        fn broken_function( {
            let x = 5
        }
        
        struct ValidStruct {
            field: i32,
        }
      `

      const result = await parseRustCode(mixedCode)
      // Even with errors, we might still extract some valid items
      expect(result.crateInfo).toBeDefined()
    })
  })

  describe('performance and limits', () => {
    it('should handle moderately large files efficiently', async () => {
      const startTime = Date.now()
      const result = await parseRustCode(TEST_FIXTURES.LARGE_FILE)
      const parseTime = Date.now() - startTime

      expect(result.success).toBe(true)
      expect(parseTime).toBeLessThan(3000) // Should complete within 3 seconds
      expect(result.parseTime).toBeGreaterThan(0)
      expect(result.crateInfo?.rootModule.items.length).toBeGreaterThan(50)
    })

    it('should report accurate parsing time', async () => {
      const result = await parseRustCode(TEST_FIXTURES.SIMPLE_FUNCTION)
      expect(result.parseTime).toBeGreaterThan(0)
      expect(result.parseTime).toBeLessThan(1000) // Should be very fast for simple code
    })
  })

  describe('real-world code patterns', () => {
    it('should handle code with macros and attributes', async () => {
      const macroCode = `
        #[derive(Debug, Clone, Serialize, Deserialize)]
        #[serde(rename_all = "camelCase")]
        pub struct ApiResponse {
            #[serde(rename = "statusCode")]
            pub status: u16,
            pub data: serde_json::Value,
            #[serde(skip_serializing_if = "Option::is_none")]
            pub error: Option<String>,
        }
        
        #[tokio::main]
        async fn main() -> Result<(), Box<dyn std::error::Error>> {
            println!("Starting application");
            Ok(())
        }
      `

      const result = await parseRustCode(macroCode)
      expect(result.success).toBe(true)

      const items = result.crateInfo!.rootModule.items
      expect(items.length).toBe(2)

      const struct = items.find((item) => item.type === 'struct')
      expect(struct?.attributes?.length || 0).toBeGreaterThan(0)
    })

    it('should handle async/await and complex types', async () => {
      const asyncCode = `
        use std::future::Future;
        use std::pin::Pin;
        
        type BoxFuture<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;
        
        async fn fetch_and_process(
            url: &str,
        ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
            let response = reqwest::get(url).await?;
            let text = response.text().await?;
            Ok(text.to_uppercase())
        }
        
        trait AsyncProcessor {
            fn process<'a>(&'a self, input: &'a str) -> BoxFuture<'a, String>;
        }
      `

      const result = await parseRustCode(asyncCode)
      expect(result.success).toBe(true)

      const items = result.crateInfo!.rootModule.items
      expect(items.length).toBeGreaterThan(3)

      const asyncFn = items.find((item) => item.name === 'fetch_and_process')
      expect(asyncFn?.type).toBe('function')
    })
  })
})
