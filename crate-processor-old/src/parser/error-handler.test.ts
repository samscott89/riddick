import { describe, it, expect, beforeEach } from 'vitest'

import {
  ParseErrorHandler,
  ValidationError,
  validateRustCode,
  createTimeoutError,
  createInitializationError,
  createParsingError,
  createMemoryError,
  createFileSizeError,
} from './error-handler'
import type { SourceLocation } from './types'

describe('ParseErrorHandler', () => {
  let handler: ParseErrorHandler

  beforeEach(() => {
    handler = new ParseErrorHandler()
  })

  describe('error management', () => {
    it('should add errors with different severities', () => {
      const location: SourceLocation = {
        startLine: 10,
        startColumn: 5,
        endLine: 10,
        endColumn: 15,
        startByte: 100,
        endByte: 110,
      }

      handler.addError('Critical error', location, 'error')
      handler.addWarning('Minor warning', location)
      handler.addError('Another error')

      expect(handler.getErrors()).toHaveLength(2)
      expect(handler.getWarnings()).toHaveLength(1)
      expect(handler.getAllErrors()).toHaveLength(3)
    })

    it('should correctly identify error states', () => {
      expect(handler.hasErrors()).toBe(false)
      expect(handler.hasWarnings()).toBe(false)

      handler.addWarning('Warning message')
      expect(handler.hasErrors()).toBe(false)
      expect(handler.hasWarnings()).toBe(true)

      handler.addError('Error message')
      expect(handler.hasErrors()).toBe(true)
      expect(handler.hasWarnings()).toBe(true)
    })

    it('should clear all errors', () => {
      handler.addError('Error 1')
      handler.addWarning('Warning 1')
      handler.addError('Error 2')

      expect(handler.getAllErrors()).toHaveLength(3)

      handler.clear()
      expect(handler.getAllErrors()).toHaveLength(0)
      expect(handler.hasErrors()).toBe(false)
      expect(handler.hasWarnings()).toBe(false)
    })
  })

  describe('error formatting', () => {
    it('should format error with location', () => {
      const location: SourceLocation = {
        startLine: 42,
        startColumn: 10,
        endLine: 42,
        endColumn: 20,
        startByte: 500,
        endByte: 510,
      }

      handler.addError('Syntax error in function declaration', location)
      const error = handler.getAllErrors()[0]
      const formatted = handler.formatError(error)

      expect(formatted).toBe(
        'ERROR at 42:10: Syntax error in function declaration',
      )
    })

    it('should format error without location', () => {
      handler.addWarning('General warning')
      const warning = handler.getAllErrors()[0]
      const formatted = handler.formatError(warning)

      expect(formatted).toBe('WARNING at unknown location: General warning')
    })

    it('should format all errors', () => {
      handler.addError('Error 1')
      handler.addWarning('Warning 1')
      handler.addError('Error 2')

      const formatted = handler.formatAllErrors()
      const lines = formatted.split('\n')

      expect(lines).toHaveLength(3)
      expect(lines[0]).toContain('ERROR')
      expect(lines[1]).toContain('WARNING')
      expect(lines[2]).toContain('ERROR')
    })

    it('should return empty string when no errors', () => {
      const formatted = handler.formatAllErrors()
      expect(formatted).toBe('')
    })
  })
})

describe('ValidationError', () => {
  it('should create validation error with message only', () => {
    const error = new ValidationError('Invalid syntax')

    expect(error.message).toBe('Invalid syntax')
    expect(error.name).toBe('ValidationError')
    expect(error.severity).toBe('error')
    expect(error.location).toBeUndefined()
  })

  it('should create validation error with location and severity', () => {
    const location: SourceLocation = {
      startLine: 5,
      startColumn: 1,
      endLine: 5,
      endColumn: 10,
      startByte: 50,
      endByte: 59,
    }

    const error = new ValidationError('Warning message', location, 'warning')

    expect(error.message).toBe('Warning message')
    expect(error.location).toBe(location)
    expect(error.severity).toBe('warning')
  })
})

describe('validateRustCode', () => {
  describe('basic validation', () => {
    it('should reject empty code', () => {
      const errors = validateRustCode('')
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toBe('Source code is empty')
      expect(errors[0].severity).toBe('error')
    })

    it('should reject whitespace-only code', () => {
      const errors = validateRustCode('   \n\t  \n  ')
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toBe('Source code is empty')
    })

    it('should accept valid code', () => {
      const errors = validateRustCode('fn main() { println!("Hello"); }')
      expect(errors).toHaveLength(0)
    })
  })

  describe('comment validation', () => {
    it('should detect unterminated block comments', () => {
      const code = `
        fn main() {
            /* This is an unterminated comment
            println!("Hello");
        }
      `
      const errors = validateRustCode(code)
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toBe('Unterminated block comment')
      expect(errors[0].severity).toBe('error')
    })

    it('should accept properly terminated block comments', () => {
      const code = `
        fn main() {
            /* This is a proper comment */
            println!("Hello");
        }
      `
      const errors = validateRustCode(code)
      expect(errors).toHaveLength(0)
    })

    it('should accept multiple block comments', () => {
      const code = `
        /* Comment 1 */
        fn main() {
            /* Comment 2 */
            println!("Hello");
        }
        /* Comment 3 */
      `
      const errors = validateRustCode(code)
      expect(errors).toHaveLength(0)
    })
  })

  describe('brace balance validation', () => {
    it('should detect unmatched opening braces', () => {
      const code = `
        fn main() {
            if true {
                println!("Hello");
            // Missing closing brace
        }
      `
      const errors = validateRustCode(code)
      expect(errors.some((e) => e.message.includes('Unmatched'))).toBe(true)
    })

    it('should detect unmatched closing braces', () => {
      const code = `
        fn main() {
            println!("Hello");
        }}
      `
      const errors = validateRustCode(code)
      expect(errors.some((e) => e.message.includes('Unmatched'))).toBe(true)
    })

    it('should detect mismatched brace types', () => {
      const code = `
        fn main() [
            println!("Hello");
        }
      `
      const errors = validateRustCode(code)
      expect(errors.some((e) => e.message.includes('Unmatched'))).toBe(true)
    })

    it('should handle braces in strings correctly', () => {
      const code = `
        fn main() {
            let message = "This } is { in a string";
            println!("{}", message);
        }
      `
      const errors = validateRustCode(code)
      expect(errors).toHaveLength(0)
    })

    it('should handle braces in comments correctly', () => {
      const code = `
        fn main() {
            // This } comment { has braces
            /* And { this } one too */
            println!("Hello");
        }
      `
      const errors = validateRustCode(code)
      expect(errors).toHaveLength(0)
    })

    it('should handle character literals correctly', () => {
      const code = `
        fn main() {
            let brace = '}';
            let bracket = ']';
            println!("{}", brace);
        }
      `
      const errors = validateRustCode(code)
      expect(errors).toHaveLength(0)
    })
  })

  describe('syntax pattern warnings', () => {
    it('should warn about function keyword', () => {
      const code = 'function main() { println!("Hello"); }'
      const errors = validateRustCode(code)
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toContain('fn')
      expect(errors[0].severity).toBe('warning')
    })

    it('should warn about var keyword', () => {
      const code = 'fn main() { var x = 5; }'
      const errors = validateRustCode(code)
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toContain('let')
      expect(errors[0].severity).toBe('warning')
    })

    it('should not warn about correct syntax', () => {
      const code = 'fn main() { let x = 5; }'
      const errors = validateRustCode(code)
      expect(errors).toHaveLength(0)
    })

    it('should handle multiple warnings', () => {
      const code = 'function main() { var x = 5; }'
      const errors = validateRustCode(code)
      expect(errors).toHaveLength(2)
      expect(errors.every((e) => e.severity === 'warning')).toBe(true)
    })
  })

  describe('complex cases', () => {
    it('should handle mixed errors and warnings', () => {
      const code = `
        function main() {
            /* Unterminated comment
            var x = 5;
            if true {
                println!("Hello");
            // Missing closing brace
        }
      `
      const errors = validateRustCode(code)
      expect(errors.length).toBeGreaterThan(2)
      expect(errors.some((e) => e.severity === 'error')).toBe(true)
      expect(errors.some((e) => e.severity === 'warning')).toBe(true)
    })

    it('should handle escaped characters in strings', () => {
      const code = `
        fn main() {
            let escaped = "This is a \\" quote";
            let braces = "These are \\{ \\} braces";
            println!("{}", escaped);
        }
      `
      const errors = validateRustCode(code)
      expect(errors).toHaveLength(0)
    })
  })
})

describe('error creation utilities', () => {
  it('should create timeout error', () => {
    const error = createTimeoutError(5000)
    expect(error.message).toBe('Parser timed out after 5000ms')
    expect(error.severity).toBe('error')
  })

  it('should create initialization error', () => {
    const originalError = new Error('Tree-sitter load failed')
    const error = createInitializationError(originalError)
    expect(error.message).toContain('Failed to initialize parser')
    expect(error.message).toContain('Tree-sitter load failed')
    expect(error.severity).toBe('error')
  })

  it('should create parsing error', () => {
    const originalError = 'Syntax error at line 5'
    const error = createParsingError(originalError)
    expect(error.message).toBe('Parsing failed: Syntax error at line 5')
    expect(error.severity).toBe('error')
  })

  it('should create memory error', () => {
    const error = createMemoryError()
    expect(error.message).toBe('Insufficient memory to parse the code')
    expect(error.severity).toBe('error')
  })

  it('should create file size error', () => {
    const error = createFileSizeError(1024000)
    expect(error.message).toBe(
      'File size exceeds maximum allowed size of 1024000 bytes',
    )
    expect(error.severity).toBe('error')
  })
})
