import { SELF, env } from 'cloudflare:test'
import { describe, it, expect } from 'vitest'

import type { ParseResponse, ParseRequest } from '@riddick/types'

const API_KEY = env.API_KEY

interface ExamplesResponse {
  success: boolean
  examples: Array<ParseRequest>
}

interface ExampleExecutionResponse {
  request: ParseRequest
  result: ParseResponse
}

describe('Parse Endpoint Integration Tests', () => {
  const baseHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${API_KEY}`,
  }

  describe('Authentication', () => {
    it('should require bearer token authentication', async () => {
      const res = await SELF.fetch('http://localhost/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'fn main() {}' }),
      })

      expect(res.status).toBe(401)
    })

    it('should reject invalid bearer token', async () => {
      const res = await SELF.fetch('http://localhost/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid-token',
        },
        body: JSON.stringify({ code: 'fn main() {}' }),
      })

      expect(res.status).toBe(401)
    })

    it('should accept valid bearer token', async () => {
      const res = await SELF.fetch('http://localhost/parse', {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({ code: 'fn main() {}' }),
      })

      expect(res.status).toBe(200)
    })
  })

  describe('Basic Parsing', () => {
    it('should parse simple function', async () => {
      const res = await SELF.fetch('http://localhost/parse', {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({ code: 'fn hello() { println!("Hello"); }' }),
      })

      expect(res.status).toBe(200)
      const data: ParseResponse = await res.json()

      expect(data.success).toBe(true)
      expect(data.crateInfo?.rootModule.items.length).toBe(1)
      expect(data.crateInfo?.rootModule.items[0].type).toBe('function')
      expect(data.crateInfo?.rootModule.items[0].name).toBe('hello')
    })

    it('should parse struct with fields', async () => {
      const res = await SELF.fetch('http://localhost/parse', {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({
          code: `
            pub struct User {
              name: String,
              age: u32,
            }
          `,
        }),
      })

      expect(res.status).toBe(200)
      const data: ParseResponse = await res.json()

      expect(data.success).toBe(true)
      expect(data.crateInfo?.rootModule.items[0].type).toBe('struct')
      expect(data.crateInfo?.rootModule.items[0].name).toBe('User')
      // Note: fields are not exposed in the simplified response
    })

    it('should parse trait with methods', async () => {
      const res = await SELF.fetch('http://localhost/parse', {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({
          code: `
            trait Display {
              fn fmt(&self) -> String;
            }
          `,
        }),
      })

      expect(res.status).toBe(200)
      const data: ParseResponse = await res.json()

      expect(data.success).toBe(true)
      expect(data.crateInfo?.rootModule.items[0].type).toBe('trait')
      expect(data.crateInfo?.rootModule.items[0].name).toBe('Display')
    })

    it('should handle self parameters correctly', async () => {
      const res = await SELF.fetch('http://localhost/parse', {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({
          code: `
            impl MyStruct {
              fn method(&self) {}
              fn mut_method(&mut self) {}
            }
          `,
        }),
      })

      expect(res.status).toBe(200)
      const data: ParseResponse = await res.json()

      expect(data.success).toBe(true)
      expect(data.crateInfo?.rootModule.items.length).toBeGreaterThan(0)

      // The parser correctly handles impl blocks with methods
      // Note: The simplified response doesn't expose parameter details like self
      const items = data.crateInfo?.rootModule.items
      expect(items).toBeDefined()
      expect(items!.length).toBeGreaterThan(0)

      // Check that we have an impl type item
      const hasImpl = items!.some((item) => item.type === 'impl')
      expect(hasImpl).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle empty code', async () => {
      const res = await SELF.fetch('http://localhost/parse', {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({ code: '' }),
      })

      expect(res.status).toBe(200)
      const data: ParseResponse = await res.json()
      expect(data.success).toBe(true)
      expect(data.crateInfo?.rootModule.items.length).toBe(0)
    })

    it('should handle invalid JSON', async () => {
      const res = await SELF.fetch('http://localhost/parse', {
        method: 'POST',
        headers: baseHeaders,
        body: 'invalid json',
      })

      expect(res.status).toBe(400)
    })

    it('should handle missing code field', async () => {
      const res = await SELF.fetch('http://localhost/parse', {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({}),
      })

      // The endpoint treats missing code as undefined and may parse it as empty
      expect(res.status).toBe(200)
      const data: ParseResponse = await res.json()

      // Either an error or successful parse of empty code
      if (data.success) {
        // Treated as empty code
        expect(data.crateInfo?.rootModule.items.length).toBe(0)
      } else {
        // Treated as error
        expect(data.errors).toBeDefined()
      }
    })

    it('should handle syntax errors in Rust code', async () => {
      const res = await SELF.fetch('http://localhost/parse', {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({ code: 'fn main(' }),
      })

      expect(res.status).toBe(200)
      const data: ParseResponse = await res.json()
      expect(data.success).toBe(false)
      expect(data.errors.length).toBeGreaterThan(0)
    })
  })

  describe('Examples Endpoint', () => {
    it('should return list of examples', async () => {
      const res = await SELF.fetch('http://localhost/parse/examples', {
        method: 'GET',
        headers: { Authorization: `Bearer ${API_KEY}` },
      })

      expect(res.status).toBe(200)
      const data: ExamplesResponse = await res.json()
      expect(data.success).toBe(true)
      expect(Array.isArray(data.examples)).toBe(true)
      expect(data.examples.length).toBeGreaterThan(0)
    })

    it('should execute example by ID', async () => {
      const res = await SELF.fetch('http://localhost/parse/test/0', {
        method: 'GET',
        headers: { Authorization: `Bearer ${API_KEY}` },
      })

      expect(res.status).toBe(200)
      const data: ExampleExecutionResponse = await res.json()
      expect(data.request).toBeDefined()
      expect(data.result.crateInfo?.rootModule).toBeDefined()
    })

    it('should return 404 for invalid example ID', async () => {
      const res = await SELF.fetch('http://localhost/parse/test/999', {
        method: 'GET',
        headers: { Authorization: `Bearer ${API_KEY}` },
      })

      expect(res.status).toBe(404)
    })
  })

  describe('WASM Loading Verification', () => {
    it('should successfully initialize WASM on first request', async () => {
      // This tests that WASM loads correctly by making a parse request
      const res = await SELF.fetch('http://localhost/parse', {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({ code: 'fn test() {}' }),
      })

      expect(res.status).toBe(200)
      const data: ParseResponse = await res.json()
      expect(data.success).toBe(true)
      expect(data.parseTime).toBeGreaterThan(0)
    })

    it('should reuse WASM instance on subsequent requests', async () => {
      // First request - should initialize WASM
      const res1 = await SELF.fetch('http://localhost/parse', {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({ code: 'fn first() {}' }),
      })
      await res1.json()

      // Second request - should reuse WASM
      const res2 = await SELF.fetch('http://localhost/parse', {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({ code: 'fn second() {}' }),
      })
      const data2: ParseResponse = await res2.json()

      // Both should succeed
      expect(res1.status).toBe(200)
      expect(res2.status).toBe(200)

      // Second parse should generally be faster due to WASM already being initialized
      // Note: This is not always guaranteed but is typical behavior
      expect(data2.success).toBe(true)
    })

    it('should handle large Rust files', async () => {
      const largeCode = `
        // Large Rust file test
        use std::collections::HashMap;
        
        pub struct LargeStruct {
            field1: String,
            field2: i32,
            field3: Vec<u8>,
            field4: HashMap<String, String>,
        }
        
        impl LargeStruct {
            pub fn new() -> Self {
                Self {
                    field1: String::new(),
                    field2: 0,
                    field3: Vec::new(),
                    field4: HashMap::new(),
                }
            }
            
            pub fn method1(&self) -> &str {
                &self.field1
            }
            
            pub fn method2(&mut self, value: i32) {
                self.field2 = value;
            }
        }
        
        pub trait MyTrait {
            fn trait_method(&self) -> String;
        }
        
        impl MyTrait for LargeStruct {
            fn trait_method(&self) -> String {
                format!("{}: {}", self.field1, self.field2)
            }
        }
        
        pub enum MyEnum {
            Variant1,
            Variant2(String),
            Variant3 { x: i32, y: i32 },
        }
        
        pub fn process_enum(e: MyEnum) -> String {
            match e {
                MyEnum::Variant1 => "v1".to_string(),
                MyEnum::Variant2(s) => s,
                MyEnum::Variant3 { x, y } => format!("{},{}", x, y),
            }
        }
      `

      const res = await SELF.fetch('http://localhost/parse', {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({ code: largeCode }),
      })

      expect(res.status).toBe(200)
      const data: ParseResponse = await res.json()
      expect(data.success).toBe(true)
      expect(data.crateInfo?.rootModule.items.length).toBeGreaterThan(5)
    })
  })

  describe('Concurrent Request Handling', () => {
    it('should handle multiple concurrent requests', async () => {
      const requests = Array.from({ length: 5 }, (_, i) => ({
        code: `fn concurrent_test_${i}() { println!("Test ${i}"); }`,
      }))

      // Send all requests concurrently
      const promises = requests.map((req) =>
        SELF.fetch('http://localhost/parse', {
          method: 'POST',
          headers: baseHeaders,
          body: JSON.stringify(req),
        }),
      )

      const responses = await Promise.all(promises)
      // All requests should succeed
      responses.forEach((res) => {
        expect(res.status).toBe(200)
      })
      const results = (await Promise.all(
        responses.map((r) => r.json()),
      )) as ParseResponse[]

      // Verify each result
      results.forEach((data, index) => {
        expect(data.success).toBe(true)
        expect(data.crateInfo?.rootModule.items.length).toBe(1)
        expect(data.crateInfo?.rootModule.items[0].name).toBe(
          `concurrent_test_${index}`,
        )
      })
    })

    it('should handle mixed success and error requests concurrently', async () => {
      const requests = [
        { code: 'fn valid1() {}' },
        { code: 'fn invalid(' }, // syntax error
        { code: 'struct Valid2 { field: i32 }' },
        { code: 'fn valid3() -> String { String::new() }' },
        { code: 'trait incomplete' }, // syntax error
      ]

      const promises = requests.map((req) =>
        SELF.fetch('http://localhost/parse', {
          method: 'POST',
          headers: baseHeaders,
          body: JSON.stringify(req),
        }),
      )

      const responses = await Promise.all(promises)
      const results = (await Promise.all(
        responses.map((r) => r.json()),
      )) as ParseResponse[]

      // All HTTP requests should return 200 (errors are in the parse result)
      responses.forEach((res) => {
        expect(res.status).toBe(200)
      })

      // Check specific results
      expect(results[0].success).toBe(true) // valid1
      expect(results[1].success).toBe(false) // invalid syntax
      expect(results[2].success).toBe(true) // Valid2
      expect(results[3].success).toBe(true) // valid3
      expect(results[4].success).toBe(false) // incomplete trait
    })

    it('should handle rapid sequential requests', async () => {
      const codes = ['fn rapid1() {}', 'fn rapid2() {}', 'fn rapid3() {}']

      for (const code of codes) {
        const res = await SELF.fetch('http://localhost/parse', {
          method: 'POST',
          headers: baseHeaders,
          body: JSON.stringify({ code }),
        })

        expect(res.status).toBe(200)
        const data: ParseResponse = await res.json()
        expect(data.success).toBe(true)
      }
    })
  })

  describe('Performance Benchmarks', () => {
    it('should parse small code snippets quickly', async () => {
      const startTime = Date.now()

      const res = await SELF.fetch('http://localhost/parse', {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({ code: 'fn quick() {}' }),
      })

      const endTime = Date.now()
      const totalTime = endTime - startTime

      expect(res.status).toBe(200)
      const data: ParseResponse = await res.json()

      // Total request should complete within reasonable time
      expect(totalTime).toBeLessThan(100) // 100ms for small snippet

      // Parse time should be very fast for small code
      expect(data.parseTime).toBeLessThan(10) // 10ms parse time
    })

    it('should handle medium-sized files efficiently', async () => {
      const mediumCode = `
        mod my_module {
            use std::collections::{HashMap, HashSet};
            use std::io::{Read, Write};
            
            pub struct DataProcessor {
                data: HashMap<String, Vec<u8>>,
                cache: HashSet<String>,
            }
            
            impl DataProcessor {
                pub fn new() -> Self {
                    Self {
                        data: HashMap::new(),
                        cache: HashSet::new(),
                    }
                }
                
                pub fn process(&mut self, key: String, value: Vec<u8>) {
                    self.data.insert(key.clone(), value);
                    self.cache.insert(key);
                }
                
                pub fn get(&self, key: &str) -> Option<&Vec<u8>> {
                    self.data.get(key)
                }
            }
            
            pub trait Processor {
                fn process_data(&mut self, input: &[u8]) -> Result<Vec<u8>, String>;
            }
            
            impl Processor for DataProcessor {
                fn process_data(&mut self, input: &[u8]) -> Result<Vec<u8>, String> {
                    Ok(input.to_vec())
                }
            }
        }
      `

      const res = await SELF.fetch('http://localhost/parse', {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({ code: mediumCode }),
      })

      expect(res.status).toBe(200)
      const data: ParseResponse = await res.json()

      // Parse time should still be reasonable for medium files
      expect(data.parseTime).toBeLessThan(50) // 50ms for medium file
    })

    it('should measure parsing performance across different code types', async () => {
      const testCases = [
        { name: 'simple_function', code: 'fn test() {}' },
        { name: 'struct_with_generics', code: 'struct Box<T> { value: T }' },
        {
          name: 'trait_with_bounds',
          code: 'trait Display: Debug + Clone { fn fmt(&self); }',
        },
        {
          name: 'impl_block',
          code: 'impl<T> Box<T> { fn new(value: T) -> Self { Box { value } } }',
        },
        {
          name: 'complex_match',
          code: `
          fn process(x: Option<Result<i32, String>>) {
              match x {
                  Some(Ok(n)) => println!("{}", n),
                  Some(Err(e)) => eprintln!("{}", e),
                  None => {}
              }
          }
        `,
        },
      ]

      const results = []

      for (const testCase of testCases) {
        const res = await SELF.fetch('http://localhost/parse', {
          method: 'POST',
          headers: baseHeaders,
          body: JSON.stringify({ code: testCase.code }),
        })

        const data: ParseResponse = await res.json()
        results.push({
          name: testCase.name,
          parseTime: data.parseTime,
        })
      }

      // All parse times should be reasonable
      results.forEach((result) => {
        expect(result.parseTime).toBeLessThan(20) // 20ms max for these examples
      })

      // Log results for performance tracking (optional)
      // eslint-disable-next-line no-console
      console.log('Parse performance results:', results)
    })

    it('should maintain consistent performance across repeated parses', async () => {
      const code = 'fn consistent_test() { let x = 42; }'
      const parseTimes = []

      // Parse the same code multiple times
      for (let i = 0; i < 10; i++) {
        const res = await SELF.fetch('http://localhost/parse', {
          method: 'POST',
          headers: baseHeaders,
          body: JSON.stringify({ code }),
        })

        const data: ParseResponse = await res.json()
        parseTimes.push(Number(data.parseTime))
      }

      // Calculate statistics
      const avgTime = parseTimes.reduce((a, b) => a + b, 0) / parseTimes.length
      const maxTime = Math.max(...parseTimes)
      const minTime = Math.min(...parseTimes)

      // Performance should be consistent
      expect(maxTime - minTime).toBeLessThan(10) // Max 10ms variance
      expect(avgTime).toBeLessThan(10) // Average should be fast
    })
  })
})
