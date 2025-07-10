// Tree-sitter WASM Rust parser implementation for Cloudflare Workers
import { Parser, Language, Query } from 'web-tree-sitter'
import type { Node } from 'web-tree-sitter'

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

export class WasmRustParser {
  private parser: Parser | null = null
  private language: Language | null = null
  private initialized = false

  constructor(private options: ParserOptions = {}) {}

  async initialize(wasmPath?: string, rustWasmPath?: string): Promise<void> {
    if (this.initialized) return

    try {
      // Initialize web-tree-sitter with custom WASM path if provided
      if (wasmPath) {
        await Parser.init({
          locateFile: (scriptName: string) => {
            if (scriptName === 'tree-sitter.wasm') {
              return wasmPath
            }
            return scriptName
          },
        })
      } else {
        await Parser.init()
      }

      this.parser = new Parser()

      // Load the Rust language WASM
      const rustWasmUrl = rustWasmPath || '/wasm/tree-sitter-rust.wasm'
      this.language = await Language.load(rustWasmUrl)
      this.parser.setLanguage(this.language)

      this.initialized = true
    } catch (error) {
      throw new Error(`Failed to initialize WASM Rust parser: ${error}`)
    }
  }

  async parseString(
    sourceCode: string,
    crateName = 'unnamed',
  ): Promise<ParseResult> {
    const startTime = performance.now()

    if (!this.initialized || !this.parser) {
      throw new Error('Parser not initialized. Call initialize() first.')
    }

    const errors: ParseError[] = []
    let crate: ParsedCrate | null = null

    try {
      // Parse the source code
      const tree = this.parser.parse(sourceCode)

      if (!tree) {
        throw new Error('Failed to parse source code')
      }

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
    node: Node,
    sourceCode: string,
    moduleName: string,
    path: string,
  ): Promise<ParsedModule> {
    const items: ParsedItem[] = []
    const submodules: ParsedModule[] = []

    // Use Tree-sitter queries to find all top-level items
    if (!this.language) {
      throw new Error('Language not loaded')
    }

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

    const query = new Query(this.language, simpleQuery)
    const captures = query.captures(node)

    for (const capture of captures) {
      // For root node, check if it's a direct child or if parent is source_file
      const isDirectChild = capture.node.parent === node || 
                           (node.type === 'source_file' && capture.node.parent?.type === 'source_file')
      
      if (isDirectChild) {
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
    node: Node,
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
    node: Node,
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
    node: Node,
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

  private extractEnum(node: Node, sourceCode: string): ParsedItem {
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

  private extractImpl(node: Node, sourceCode: string): ParsedItem {
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
    node: Node,
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
    node: Node,
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
    node: Node,
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
    node: Node,
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
    node: Node,
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

  private extractUse(node: Node, sourceCode: string): ParsedItem {
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
    node: Node,
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
    node: Node,
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
    node: Node,
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
    node: Node,
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
    node: Node,
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
    node: Node,
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
    node: Node,
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
    node: Node,
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

  private getSourceLocation(node: Node): SourceLocation {
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
    node: Node | null,
    sourceCode: string,
  ): string {
    if (!node) return ''
    return sourceCode.slice(node.startIndex, node.endIndex)
  }


  dispose(): void {
    if (this.parser) {
      this.parser.delete()
      this.parser = null
    }
    this.initialized = false
  }
}

// Factory function for creating WASM Rust parser instances
export function createWasmRustParser(options: ParserOptions = {}): WasmRustParser {
  return new WasmRustParser(options)
}

// Utility function for quick parsing with WASM Tree-sitter
export async function parseRustCodeWasm(
  sourceCode: string,
  options: ParserOptions = {},
  wasmPath?: string,
  rustWasmPath?: string,
): Promise<ParseResult> {
  const parser = createWasmRustParser(options)
  await parser.initialize(wasmPath, rustWasmPath)

  try {
    return await parser.parseString(sourceCode)
  } finally {
    parser.dispose()
  }
}