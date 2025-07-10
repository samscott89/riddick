// Tree-sitter Rust parser implementation
import Parser from 'tree-sitter'
import Rust from 'tree-sitter-rust'
import type {
  ParsedCrate,
  ParsedModule,
  ParsedItem,
  ParseError,
  ParseResult,
  ParserOptions,
  SourceLocation,
  ItemType,
  FunctionParameter,
  StructField,
  EnumVariant,
} from './types'

export class RustParser {
  private parser: Parser
  private initialized = false

  constructor(_options: ParserOptions = {}) {
    this.parser = new Parser()
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      this.parser.setLanguage(Rust as any)
      this.initialized = true
    } catch (error) {
      throw new Error(`Failed to initialize Rust parser: ${error}`)
    }
  }

  async parseString(
    sourceCode: string,
    crateName = 'unnamed',
  ): Promise<ParseResult> {
    const startTime = performance.now()

    if (!this.initialized) {
      throw new Error('Parser not initialized. Call initialize() first.')
    }

    const errors: ParseError[] = []
    let crate: ParsedCrate | null = null

    try {
      // Parse the source code
      const tree = this.parser.parse(sourceCode)

      if (tree.rootNode.hasError) {
        this.extractSyntaxErrors(tree.rootNode, sourceCode, errors)
      }

      // Extract the root module
      const rootModule = await this.extractModule(
        tree.rootNode,
        sourceCode,
        'root',
        'main.rs',
      )

      crate = {
        name: crateName,
        modules: [rootModule],
        rootModule,
        errors: errors.filter((e) => e.severity === 'error'),
      }

      return {
        crate,
        errors,
        success: errors.filter((e) => e.severity === 'error').length === 0,
        parseTime: Math.max(1, Math.round(performance.now() - startTime)),
      }
    } catch (error) {
      errors.push({
        message: `Parse error: ${error}`,
        severity: 'error',
      })

      return {
        crate: null,
        errors,
        success: false,
        parseTime: Math.max(1, Math.round(performance.now() - startTime)),
      }
    }
  }

  private async extractModule(
    node: Parser.SyntaxNode,
    sourceCode: string,
    moduleName: string,
    path: string,
  ): Promise<ParsedModule> {
    const items: ParsedItem[] = []
    const submodules: ParsedModule[] = []

    // Use Tree-sitter queries to find all top-level items
    const language = this.parser.getLanguage()

    // Simple query that finds all direct children item types
    const simpleQuery = `
      (function_item) @function
      (struct_item) @struct
      (enum_item) @enum
      (impl_item) @impl
      (mod_item) @module
      (trait_item) @trait
      (type_item) @type_alias
      (const_item) @const
      (static_item) @static
      (use_declaration) @use
      (macro_definition) @macro
    `

    const query = new Parser.Query(language, simpleQuery)
    const captures = query.captures(node)

    for (const capture of captures) {
      // Only process direct children, not nested items
      if (capture.node.parent === node) {
        const item = this.extractItem(capture.node, sourceCode)
        if (item) {
          items.push(item)

          if (item.type === 'mod') {
            // Also extract the module's contents as a submodule
            const bodyNode = capture.node.childForFieldName('body')
            if (bodyNode) {
              const submodule = await this.extractModule(
                bodyNode,
                sourceCode,
                item.name,
                `${path}/${item.name}.rs`,
              )
              submodules.push(submodule)
            }
          }
        }
      }
    }

    return {
      name: moduleName,
      path,
      items,
      location: this.getSourceLocation(node),
      submodules,
    }
  }

  private extractItem(
    node: Parser.SyntaxNode,
    sourceCode: string,
  ): ParsedItem | null {
    const nodeType = node.type

    switch (nodeType) {
      case 'function_item':
        return this.extractFunction(node, sourceCode)
      case 'struct_item':
        return this.extractStruct(node, sourceCode)
      case 'enum_item':
        return this.extractEnum(node, sourceCode)
      case 'impl_item':
        return this.extractImpl(node, sourceCode)
      case 'mod_item':
        return this.extractModuleItem(node, sourceCode)
      case 'trait_item':
        return this.extractTrait(node, sourceCode)
      case 'type_item':
        return this.extractTypeAlias(node, sourceCode)
      case 'const_item':
        return this.extractConstant(node, sourceCode)
      case 'static_item':
        return this.extractStatic(node, sourceCode)
      case 'use_declaration':
        return this.extractUse(node, sourceCode)
      case 'macro_definition':
        return this.extractMacro(node, sourceCode)
      default:
        return null
    }
  }

  private extractFunction(
    node: Parser.SyntaxNode,
    sourceCode: string,
  ): ParsedItem {
    const name = this.getNodeText(node.childForFieldName('name'), sourceCode)
    const parameters = this.extractFunctionParameters(node, sourceCode)
    const returnType = this.getNodeText(
      node.childForFieldName('return_type'),
      sourceCode,
    )
    const visibility = this.extractVisibility(node, sourceCode)
    const attributes = this.extractAttributes(node, sourceCode)
    const genericParameters = this.extractGenericParameters(node, sourceCode)

    return {
      type: 'function' as ItemType,
      name,
      sourceCode: this.getNodeText(node, sourceCode),
      location: this.getSourceLocation(node),
      visibility,
      attributes,
      genericParameters,
      parameters,
      returnType: returnType || undefined,
    }
  }

  private extractStruct(
    node: Parser.SyntaxNode,
    sourceCode: string,
  ): ParsedItem {
    const name = this.getNodeText(node.childForFieldName('name'), sourceCode)
    const fields = this.extractStructFields(node, sourceCode)
    const visibility = this.extractVisibility(node, sourceCode)
    const attributes = this.extractAttributes(node, sourceCode)
    const genericParameters = this.extractGenericParameters(node, sourceCode)

    return {
      type: 'struct' as ItemType,
      name,
      sourceCode: this.getNodeText(node, sourceCode),
      location: this.getSourceLocation(node),
      visibility,
      attributes,
      genericParameters,
      fields,
    }
  }

  private extractEnum(node: Parser.SyntaxNode, sourceCode: string): ParsedItem {
    const name = this.getNodeText(node.childForFieldName('name'), sourceCode)
    const variants = this.extractEnumVariants(node, sourceCode)
    const visibility = this.extractVisibility(node, sourceCode)
    const attributes = this.extractAttributes(node, sourceCode)
    const genericParameters = this.extractGenericParameters(node, sourceCode)

    return {
      type: 'enum' as ItemType,
      name,
      sourceCode: this.getNodeText(node, sourceCode),
      location: this.getSourceLocation(node),
      visibility,
      attributes,
      genericParameters,
      variants,
    }
  }

  private extractImpl(node: Parser.SyntaxNode, sourceCode: string): ParsedItem {
    const implType = this.getNodeText(
      node.childForFieldName('type'),
      sourceCode,
    )
    const traitName = this.getNodeText(
      node.childForFieldName('trait'),
      sourceCode,
    )
    const attributes = this.extractAttributes(node, sourceCode)
    const genericParameters = this.extractGenericParameters(node, sourceCode)

    // Extract associated items (methods, constants, types)
    const associatedItems: ParsedItem[] = []
    const bodyNode = node.childForFieldName('body')
    if (bodyNode) {
      for (let i = 0; i < bodyNode.childCount; i++) {
        const child = bodyNode.child(i)
        if (child) {
          const item = this.extractItem(child, sourceCode)
          if (item) {
            associatedItems.push(item)
          }
        }
      }
    }

    return {
      type: 'impl' as ItemType,
      name: traitName ? `${traitName} for ${implType}` : implType,
      sourceCode: this.getNodeText(node, sourceCode),
      location: this.getSourceLocation(node),
      attributes,
      genericParameters,
      implType,
      traitName: traitName || undefined,
      associatedItems,
    }
  }

  private extractModuleItem(
    node: Parser.SyntaxNode,
    sourceCode: string,
  ): ParsedItem {
    const name = this.getNodeText(node.childForFieldName('name'), sourceCode)
    const visibility = this.extractVisibility(node, sourceCode)
    const attributes = this.extractAttributes(node, sourceCode)

    return {
      type: 'mod' as ItemType,
      name,
      sourceCode: this.getNodeText(node, sourceCode),
      location: this.getSourceLocation(node),
      visibility,
      attributes,
    }
  }

  private extractTrait(
    node: Parser.SyntaxNode,
    sourceCode: string,
  ): ParsedItem {
    const name = this.getNodeText(node.childForFieldName('name'), sourceCode)
    const visibility = this.extractVisibility(node, sourceCode)
    const attributes = this.extractAttributes(node, sourceCode)
    const genericParameters = this.extractGenericParameters(node, sourceCode)

    return {
      type: 'trait' as ItemType,
      name,
      sourceCode: this.getNodeText(node, sourceCode),
      location: this.getSourceLocation(node),
      visibility,
      attributes,
      genericParameters,
    }
  }

  private extractTypeAlias(
    node: Parser.SyntaxNode,
    sourceCode: string,
  ): ParsedItem {
    const name = this.getNodeText(node.childForFieldName('name'), sourceCode)
    const visibility = this.extractVisibility(node, sourceCode)
    const attributes = this.extractAttributes(node, sourceCode)
    const genericParameters = this.extractGenericParameters(node, sourceCode)

    return {
      type: 'type_alias' as ItemType,
      name,
      sourceCode: this.getNodeText(node, sourceCode),
      location: this.getSourceLocation(node),
      visibility,
      attributes,
      genericParameters,
    }
  }

  private extractConstant(
    node: Parser.SyntaxNode,
    sourceCode: string,
  ): ParsedItem {
    const name = this.getNodeText(node.childForFieldName('name'), sourceCode)
    const visibility = this.extractVisibility(node, sourceCode)
    const attributes = this.extractAttributes(node, sourceCode)

    return {
      type: 'const' as ItemType,
      name,
      sourceCode: this.getNodeText(node, sourceCode),
      location: this.getSourceLocation(node),
      visibility,
      attributes,
    }
  }

  private extractStatic(
    node: Parser.SyntaxNode,
    sourceCode: string,
  ): ParsedItem {
    const name = this.getNodeText(node.childForFieldName('name'), sourceCode)
    const visibility = this.extractVisibility(node, sourceCode)
    const attributes = this.extractAttributes(node, sourceCode)

    return {
      type: 'static' as ItemType,
      name,
      sourceCode: this.getNodeText(node, sourceCode),
      location: this.getSourceLocation(node),
      visibility,
      attributes,
    }
  }

  private extractUse(node: Parser.SyntaxNode, sourceCode: string): ParsedItem {
    const useTree = this.getNodeText(
      node.childForFieldName('argument'),
      sourceCode,
    )
    const visibility = this.extractVisibility(node, sourceCode)
    const attributes = this.extractAttributes(node, sourceCode)

    return {
      type: 'use' as ItemType,
      name: useTree,
      sourceCode: this.getNodeText(node, sourceCode),
      location: this.getSourceLocation(node),
      visibility,
      attributes,
    }
  }

  private extractMacro(
    node: Parser.SyntaxNode,
    sourceCode: string,
  ): ParsedItem {
    const name = this.getNodeText(node.childForFieldName('name'), sourceCode)
    const visibility = this.extractVisibility(node, sourceCode)
    const attributes = this.extractAttributes(node, sourceCode)

    return {
      type: 'macro' as ItemType,
      name,
      sourceCode: this.getNodeText(node, sourceCode),
      location: this.getSourceLocation(node),
      visibility,
      attributes,
    }
  }

  private extractFunctionParameters(
    node: Parser.SyntaxNode,
    sourceCode: string,
  ): FunctionParameter[] {
    const parameters: FunctionParameter[] = []
    const paramsNode = node.childForFieldName('parameters')

    if (!paramsNode) return parameters

    for (let i = 0; i < paramsNode.childCount; i++) {
      const child = paramsNode.child(i)
      if (child?.type === 'parameter') {
        const name = this.getNodeText(
          child.childForFieldName('pattern'),
          sourceCode,
        )
        const type = this.getNodeText(
          child.childForFieldName('type'),
          sourceCode,
        )

        parameters.push({
          name,
          type,
          isSelf: name === 'self',
          isMutable: name.startsWith('mut '),
        })
      } else if (child?.type === 'self_parameter') {
        parameters.push({
          name: 'self',
          type: 'Self',
          isSelf: true,
          isMutable: child.text.includes('mut'),
        })
      }
    }

    return parameters
  }

  private extractStructFields(
    node: Parser.SyntaxNode,
    sourceCode: string,
  ): StructField[] {
    const fields: StructField[] = []
    const bodyNode = node.childForFieldName('body')

    if (!bodyNode) return fields

    for (let i = 0; i < bodyNode.childCount; i++) {
      const child = bodyNode.child(i)
      if (child?.type === 'field_declaration') {
        const name = this.getNodeText(
          child.childForFieldName('name'),
          sourceCode,
        )
        const type = this.getNodeText(
          child.childForFieldName('type'),
          sourceCode,
        )
        const visibility = this.extractVisibility(child, sourceCode)

        fields.push({
          name,
          type,
          visibility,
        })
      }
    }

    return fields
  }

  private extractEnumVariants(
    node: Parser.SyntaxNode,
    sourceCode: string,
  ): EnumVariant[] {
    const variants: EnumVariant[] = []
    const bodyNode = node.childForFieldName('body')

    if (!bodyNode) return variants

    for (let i = 0; i < bodyNode.childCount; i++) {
      const child = bodyNode.child(i)
      if (child?.type === 'enum_variant') {
        const name = this.getNodeText(
          child.childForFieldName('name'),
          sourceCode,
        )
        const discriminant = this.getNodeText(
          child.childForFieldName('discriminant'),
          sourceCode,
        )

        variants.push({
          name,
          discriminant: discriminant || undefined,
        })
      }
    }

    return variants
  }

  private extractVisibility(
    node: Parser.SyntaxNode,
    sourceCode: string,
  ): ParsedItem['visibility'] {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i)
      if (child?.type === 'visibility_modifier') {
        const text = this.getNodeText(child, sourceCode)
        if (text === 'pub') return 'pub'
        if (text.includes('pub(crate)')) return 'pub(crate)'
        if (text.includes('pub(super)')) return 'pub(super)'
        if (text.includes('pub(in')) return 'pub(in path)'
      }
    }
    return 'private'
  }

  private extractAttributes(
    node: Parser.SyntaxNode,
    sourceCode: string,
  ): string[] {
    const attributes: string[] = []

    // Look for attribute items in the children
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i)
      if (child?.type === 'attribute_item') {
        attributes.push(this.getNodeText(child, sourceCode))
      }
    }

    // Also check the parent node for attributes that come before this item
    if (node.parent) {
      const parentNode = node.parent
      for (let i = 0; i < parentNode.childCount; i++) {
        const child = parentNode.child(i)
        if (child === node) break // Stop when we reach the current node
        if (child?.type === 'attribute_item') {
          attributes.push(this.getNodeText(child, sourceCode))
        }
      }
    }

    return attributes
  }

  private extractGenericParameters(
    node: Parser.SyntaxNode,
    sourceCode: string,
  ): string[] {
    const generics: string[] = []
    // Look for type_parameters in the node's children
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i)
      if (child?.type === 'type_parameters') {
        // Found type parameters, extract them
        for (let j = 0; j < child.childCount; j++) {
          const param = child.child(j)
          if (param?.type === 'type_parameter') {
            const name = this.getNodeText(param, sourceCode)
            generics.push(name)
          }
        }
      }
    }

    return generics
  }

  private extractSyntaxErrors(
    node: Parser.SyntaxNode,
    sourceCode: string,
    errors: ParseError[],
  ): void {
    if (node.hasError) {
      if (node.type === 'ERROR') {
        errors.push({
          message: `Syntax error: ${node.text}`,
          location: this.getSourceLocation(node),
          severity: 'error',
        })
      }

      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i)
        if (child) {
          this.extractSyntaxErrors(child, sourceCode, errors)
        }
      }
    }
  }

  private getSourceLocation(node: Parser.SyntaxNode): SourceLocation {
    return {
      startLine: node.startPosition.row + 1,
      startColumn: node.startPosition.column + 1,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column + 1,
      startByte: node.startIndex,
      endByte: node.endIndex,
    }
  }

  private getNodeText(
    node: Parser.SyntaxNode | null,
    sourceCode: string,
  ): string {
    if (!node) return ''
    return sourceCode.slice(node.startIndex, node.endIndex)
  }

  dispose(): void {
    // Tree-sitter doesn't require explicit cleanup
    this.initialized = false
  }
}

// Factory function for creating Rust parser instances
export function createRustParser(options: ParserOptions = {}): RustParser {
  return new RustParser(options)
}

// Utility function for quick parsing with Tree-sitter
export async function parseRustCode(
  sourceCode: string,
  options: ParserOptions = {},
): Promise<ParseResult> {
  const parser = createRustParser(options)
  await parser.initialize()

  try {
    return await parser.parseString(sourceCode)
  } finally {
    parser.dispose()
  }
}
