import Parser from 'web-tree-sitter'

import { RUST_QUERIES } from './queries'
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

// Type definitions for web-tree-sitter (simplified for our use case)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SyntaxNode = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Language = any

export class RustParser {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parser: any = null
  private rustLanguage: Language | null = null
  private initialized = false

  constructor(_options: ParserOptions = {}) {}

  async initialize(wasmPath?: string): Promise<void> {
    if (this.initialized) return

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (Parser as any).init()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.parser = new (Parser as any)()

      // Load the Rust grammar
      const rustWasm = wasmPath || 'tree-sitter-rust.wasm'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.rustLanguage = await (Parser as any).Language.load(rustWasm)
      this.parser.setLanguage(this.rustLanguage)

      this.initialized = true
    } catch (error) {
      throw new Error(`Failed to initialize Rust parser: ${error}`)
    }
  }

  async parseString(
    sourceCode: string,
    crateName = 'unnamed',
  ): Promise<ParseResult> {
    const startTime = Date.now()

    if (!this.initialized) {
      throw new Error('Parser not initialized. Call initialize() first.')
    }

    if (!this.parser) {
      throw new Error('Parser instance not available')
    }

    const errors: ParseError[] = []
    let crate: ParsedCrate | null = null

    try {
      // Parse the source code
      const tree = this.parser.parse(sourceCode)

      if (tree.rootNode.hasError()) {
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
        parseTime: Date.now() - startTime,
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
        parseTime: Date.now() - startTime,
      }
    }
  }

  private async extractModule(
    node: SyntaxNode,
    sourceCode: string,
    moduleName: string,
    path: string,
  ): Promise<ParsedModule> {
    const items: ParsedItem[] = []
    const submodules: ParsedModule[] = []

    // Query for all top-level items
    const query = this.rustLanguage!.query(RUST_QUERIES.TOP_LEVEL_ITEMS)
    const captures = query.captures(node)

    for (const capture of captures) {
      const item = this.extractItem(capture.node, sourceCode)
      if (item) {
        if (item.type === 'mod') {
          // Handle submodules
          const submodule = await this.extractModule(
            capture.node,
            sourceCode,
            item.name,
            `${path}/${item.name}.rs`,
          )
          submodules.push(submodule)
        } else {
          items.push(item)
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

  private extractItem(node: SyntaxNode, sourceCode: string): ParsedItem | null {
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

  private extractFunction(node: SyntaxNode, sourceCode: string): ParsedItem {
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

  private extractStruct(node: SyntaxNode, sourceCode: string): ParsedItem {
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

  private extractEnum(node: SyntaxNode, sourceCode: string): ParsedItem {
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

  private extractImpl(node: SyntaxNode, sourceCode: string): ParsedItem {
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

  private extractModuleItem(node: SyntaxNode, sourceCode: string): ParsedItem {
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

  private extractTrait(node: SyntaxNode, sourceCode: string): ParsedItem {
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

  private extractTypeAlias(node: SyntaxNode, sourceCode: string): ParsedItem {
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

  private extractConstant(node: SyntaxNode, sourceCode: string): ParsedItem {
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

  private extractStatic(node: SyntaxNode, sourceCode: string): ParsedItem {
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

  private extractUse(node: SyntaxNode, sourceCode: string): ParsedItem {
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

  private extractMacro(node: SyntaxNode, sourceCode: string): ParsedItem {
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
    node: SyntaxNode,
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
    node: SyntaxNode,
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
    node: SyntaxNode,
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
    node: SyntaxNode,
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

  private extractAttributes(node: SyntaxNode, sourceCode: string): string[] {
    const attributes: string[] = []

    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i)
      if (child?.type === 'attribute_item') {
        attributes.push(this.getNodeText(child, sourceCode))
      }
    }

    return attributes
  }

  private extractGenericParameters(
    node: SyntaxNode,
    sourceCode: string,
  ): string[] {
    const generics: string[] = []
    const genericsNode = node.childForFieldName('generic_parameters')

    if (!genericsNode) return generics

    for (let i = 0; i < genericsNode.childCount; i++) {
      const child = genericsNode.child(i)
      if (child?.type === 'type_parameter') {
        const name = this.getNodeText(
          child.childForFieldName('name'),
          sourceCode,
        )
        if (name) generics.push(name)
      }
    }

    return generics
  }

  private extractSyntaxErrors(
    node: SyntaxNode,
    sourceCode: string,
    errors: ParseError[],
  ): void {
    if (node.hasError()) {
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

  private getSourceLocation(node: SyntaxNode): SourceLocation {
    return {
      startLine: node.startPosition.row + 1,
      startColumn: node.startPosition.column + 1,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column + 1,
      startByte: node.startIndex,
      endByte: node.endIndex,
    }
  }

  private getNodeText(node: SyntaxNode | null, sourceCode: string): string {
    if (!node) return ''
    return sourceCode.slice(node.startIndex, node.endIndex)
  }

  dispose(): void {
    if (this.parser) {
      this.parser.delete()
      this.parser = null
    }
    this.rustLanguage = null
    this.initialized = false
  }
}

// Factory function for creating parser instances
export function createRustParser(options: ParserOptions = {}): RustParser {
  return new RustParser(options)
}

// Utility function for quick parsing
export async function parseRustCode(
  sourceCode: string,
  options: ParserOptions = {},
  wasmPath?: string,
): Promise<ParseResult> {
  const parser = createRustParser(options)
  await parser.initialize(wasmPath)

  try {
    return await parser.parseString(sourceCode)
  } finally {
    parser.dispose()
  }
}
