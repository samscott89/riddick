import type { ParseError, SourceLocation } from './types'

export class ParseErrorHandler {
  private errors: ParseError[] = []

  addError(
    message: string,
    location?: SourceLocation,
    severity: 'error' | 'warning' = 'error',
  ): void {
    this.errors.push({
      message,
      location,
      severity,
    })
  }

  addWarning(message: string, location?: SourceLocation): void {
    this.addError(message, location, 'warning')
  }

  getErrors(): ParseError[] {
    return this.errors.filter((e) => e.severity === 'error')
  }

  getWarnings(): ParseError[] {
    return this.errors.filter((e) => e.severity === 'warning')
  }

  getAllErrors(): ParseError[] {
    return [...this.errors]
  }

  hasErrors(): boolean {
    return this.errors.some((e) => e.severity === 'error')
  }

  hasWarnings(): boolean {
    return this.errors.some((e) => e.severity === 'warning')
  }

  clear(): void {
    this.errors = []
  }

  formatError(error: ParseError): string {
    const location = error.location
    const locationStr = location
      ? `${location.startLine}:${location.startColumn}`
      : 'unknown location'

    return `${error.severity.toUpperCase()} at ${locationStr}: ${error.message}`
  }

  formatAllErrors(): string {
    return this.errors.map((error) => this.formatError(error)).join('\n')
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public location?: SourceLocation,
    public severity: 'error' | 'warning' = 'error',
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

export function validateRustCode(sourceCode: string): ParseError[] {
  const errors: ParseError[] = []

  // Basic validation checks
  if (!sourceCode.trim()) {
    errors.push({
      message: 'Source code is empty',
      severity: 'error',
    })
    return errors
  }

  // Check for basic syntax issues
  if (sourceCode.includes('/*') && !sourceCode.includes('*/')) {
    errors.push({
      message: 'Unterminated block comment',
      severity: 'error',
    })
  }

  // Check for unmatched braces
  const braceBalance = checkBraceBalance(sourceCode)
  if (braceBalance.unmatched.length > 0) {
    braceBalance.unmatched.forEach((brace) => {
      errors.push({
        message: `Unmatched ${brace.type} brace`,
        location: brace.location,
        severity: 'error',
      })
    })
  }

  // Check for common Rust syntax patterns
  if (sourceCode.includes('function ') && !sourceCode.includes('fn ')) {
    errors.push({
      message: 'Rust uses "fn" for function declarations, not "function"',
      severity: 'warning',
    })
  }

  if (sourceCode.includes('var ') && !sourceCode.includes('let ')) {
    errors.push({
      message: 'Rust uses "let" for variable declarations, not "var"',
      severity: 'warning',
    })
  }

  return errors
}

interface BraceInfo {
  type: 'curly' | 'square' | 'round'
  location: SourceLocation
  char: string
}

function checkBraceBalance(sourceCode: string): {
  balanced: boolean
  unmatched: BraceInfo[]
} {
  const stack: BraceInfo[] = []
  const unmatched: BraceInfo[] = []
  const lines = sourceCode.split('\n')

  const braceMap: Record<string, string> = {
    '{': '}',
    '[': ']',
    '(': ')',
  }

  const closingBraces = new Set(Object.values(braceMap))

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]
    let inString = false
    let inChar = false
    let inComment = false
    let inBlockComment = false

    for (let charIndex = 0; charIndex < line.length; charIndex++) {
      const char = line[charIndex]
      const nextChar = line[charIndex + 1]

      // Handle comments
      if (!inString && !inChar && char === '/' && nextChar === '/') {
        inComment = true
        continue
      }

      if (!inString && !inChar && char === '/' && nextChar === '*') {
        inBlockComment = true
        charIndex++ // Skip the '*'
        continue
      }

      if (inBlockComment && char === '*' && nextChar === '/') {
        inBlockComment = false
        charIndex++ // Skip the '/'
        continue
      }

      if (inComment || inBlockComment) continue

      // Handle string literals
      if (char === '"' && !inChar) {
        inString = !inString
        continue
      }

      // Handle character literals
      if (char === "'" && !inString) {
        inChar = !inChar
        continue
      }

      if (inString || inChar) continue

      // Handle braces
      if (char in braceMap) {
        const braceType =
          char === '{' ? 'curly' : char === '[' ? 'square' : 'round'
        stack.push({
          type: braceType,
          location: {
            startLine: lineIndex + 1,
            startColumn: charIndex + 1,
            endLine: lineIndex + 1,
            endColumn: charIndex + 2,
            startByte: 0, // We don't calculate byte positions here
            endByte: 0,
          },
          char,
        })
      } else if (closingBraces.has(char)) {
        const expectedOpening = Object.entries(braceMap).find(
          ([, closing]) => closing === char,
        )?.[0]

        if (stack.length === 0) {
          unmatched.push({
            type: char === '}' ? 'curly' : char === ']' ? 'square' : 'round',
            location: {
              startLine: lineIndex + 1,
              startColumn: charIndex + 1,
              endLine: lineIndex + 1,
              endColumn: charIndex + 2,
              startByte: 0,
              endByte: 0,
            },
            char,
          })
        } else {
          const lastOpening = stack[stack.length - 1]
          if (lastOpening.char === expectedOpening) {
            stack.pop()
          } else {
            unmatched.push(lastOpening)
            stack.pop()
          }
        }
      }
    }
  }

  // Any remaining opening braces are unmatched
  unmatched.push(...stack)

  return {
    balanced: unmatched.length === 0,
    unmatched,
  }
}

export function createTimeoutError(timeout: number): ParseError {
  return {
    message: `Parser timed out after ${timeout}ms`,
    severity: 'error',
  }
}

export function createInitializationError(error: unknown): ParseError {
  return {
    message: `Failed to initialize parser: ${error}`,
    severity: 'error',
  }
}

export function createParsingError(error: unknown): ParseError {
  return {
    message: `Parsing failed: ${error}`,
    severity: 'error',
  }
}

export function createMemoryError(): ParseError {
  return {
    message: 'Insufficient memory to parse the code',
    severity: 'error',
  }
}

export function createFileSizeError(maxSize: number): ParseError {
  return {
    message: `File size exceeds maximum allowed size of ${maxSize} bytes`,
    severity: 'error',
  }
}
