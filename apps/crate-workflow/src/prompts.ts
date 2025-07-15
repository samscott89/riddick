import type { FileInfo, ItemInfo } from '@riddick/types'

/**
 * System prompt defining the AI's persona and rules.
 * This should be passed in the 'system' role of a chat request.
 */
export function getSystemPrompt(): string {
  return `You are an expert Rust programmer creating concise, technical documentation for a developer audience. Your goal is to explain what a piece of code does, how to use it, and its role in the larger system.

CRITICAL RULE: If the provided doc comments are already clear, comprehensive, and sufficient to understand the item, you MUST respond with the single phrase: "NO_SUMMARY_NEEDED". Otherwise, provide your summary.`
}

/**
 * Creates a user prompt for summarizing a Rust function.
 */
export function getFunctionSummaryPrompt(
  signature: string,
  doc_comment: string | null,
  source_code: string,
): string {
  return `Analyze the following Rust function.

**Signature:**
\`\`\`rust
${signature}
\`\`\`

**Doc Comments:**
\`\`\`
${doc_comment || 'N/A'}
\`\`\`

**Source Code:**
\`\`\`rust
${source_code}
\`\`\`

**Task:**
Based on the context, provide a concise, technical summary. Explain what the function does, its parameters, what it returns, and any key logic, side effects, or error conditions.`
}

/**
 * Generates a text skeleton of a struct's public API from its items.
 * @param {ItemInfo[]} items - The array of items within the struct.
 * @returns {string} A string representing the struct's public API.
 */
function createAdtSkeleton(items: ItemInfo[]): string {
  return items
    .map((item) => {
      if ('function' in item.details) {
        // We can extract the signature from the full code for simplicity
        return item.details.function.signature
      }
      if ('adt' in item.details) {
        return `/// ${item.docComment?.split('\n').join('///') || ''}\n${item.name}`
      }

      return null // Skip items that are not functions or structs/enums
    })
    .filter(Boolean)
    .join('\n')
}

/**
 * Creates a user prompt for summarizing a Rust struct or enum.
 */
export function getStructOrEnumSummaryPrompt(item: ItemInfo): string {
  const source_code = item.fullCode
  const doc_comment = item.docComment
  if (!('adt' in item.details)) {
    throw new Error('Item does not contain ADT details')
  }
  const skeleton = createAdtSkeleton(item.details.adt.methods)

  return `Analyze the following Rust data structure.

**Definition:**
\`\`\`rust
${source_code}
\`\`\`

**Doc Comments:**
\`\`\`
${doc_comment || 'N/A'}
\`\`\`

**Public API:**
\`\`\`rust
${skeleton}
\`\`\`


**Task:**
Based on the context, provide a concise, technical summary. Explain the purpose of this data structure. For a struct, describe what its fields represent. For an enum, describe the different states or variants it can represent.`
}

/**
 * Creates a user prompt for summarizing a Rust trait.
 */
export function getTraitSummaryPrompt(
  source_code: string,
  doc_comment: string | null,
): string {
  return `Analyze the following Rust trait.

**Definition:**
\`\`\`rust
${source_code}
\`\`\`

**Doc Comments:**
\`\`\`
${doc_comment || 'N/A'}
\`\`\`

**Task:**
Based on the context, provide a concise, technical summary. Explain the abstract behavior or contract that this trait defines. What capabilities does a type gain by implementing it? What is the purpose of its methods and any associated types?`
}

/**
 * Generates a text skeleton of a module's public API from its items.
 * @param {ItemInfo[]} items - The array of items within the module.
 * @returns {string} A string representing the module's public API.
 */
function createModuleSkeleton(items: ItemInfo[]): string {
  return items
    .map((item) => {
      if ('function' in item.details) {
        // We can extract the signature from the full code for simplicity
        return item.details.function.signature
      }
      if ('adt' in item.details) {
        return `/// ${item.docComment?.split('\n').join('///') || ''}\n${item.name}`
      }

      return null // Skip items that are not functions or structs/enums
    })
    .filter(Boolean)
    .join('\n')
}

/**
 * Creates a user prompt for summarizing a Rust module.
 */
export function getModuleSummaryPrompt(
  module_path: string,
  module_info: FileInfo,
): string {
  const module_skeleton = createModuleSkeleton(module_info.items)
  return `Analyze the following Rust module skeleton.

**Module Path:** \`${module_path}\`

**Public API:**
\`\`\`rust
${module_skeleton}
\`\`\`

**Task:**
Based on the public items it exposes, provide a high-level technical summary of this module's purpose and responsibility. What kind of functionality does it group together? How do its parts seem to relate to each other?`
}

export function getPromptForItem(item: ItemInfo): string | null {
  if ('function' in item.details) {
    const _functionDetails = item.details.function

    return getFunctionSummaryPrompt(item.name, item.docComment, item.fullCode)
  }
  if ('adt' in item.details) {
    return getStructOrEnumSummaryPrompt(item)
  }
  if ('trait' in item.details) {
    return getTraitSummaryPrompt(item.fullCode, item.docComment)
  }
  return null
}
