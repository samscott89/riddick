use ra_ap_syntax::{
    ast::{self, HasDocComments, HasModuleItem, HasName, HasVisibility},
    AstNode, AstToken, SourceFile, TextRange,
};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct ParseRequest {
    pub code: String,
    pub file_path: Option<String>, // Optional file path for context
    pub include_private: bool,     // Whether to include private items
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct ParseResponse {
    pub success: bool,
    pub parse_time: u64,
    pub file_info: Option<FileInfo>,
    pub errors: Vec<ParseError>,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
    pub items: Vec<ItemInfo>, // All items including inline modules
    pub module_references: Vec<ModuleReference>, // Modules declared with `mod foo;`
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct ModuleInfo {
    pub name: String,
    pub items: Vec<ItemInfo>, // Non-module items (functions, structs, etc.)
    pub inline_modules: Vec<ModuleInfo>, // Nested inline modules
    pub module_references: Vec<ModuleReference>, // Referenced modules
    pub location: [u32; 2],   // [start_byte, end_byte] in the file
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct ModuleReference {
    pub name: String,
    pub visibility: String,          // "pub", "pub(crate)", "private", etc.
    pub expected_paths: Vec<String>, // Potential file paths (foo.rs, foo/mod.rs)
    pub location: [u32; 2],          // [start_byte, end_byte] in the file
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct ItemInfo {
    pub name: String,
    pub full_code: String,
    pub doc_comment: Option<String>,
    pub visibility: String, // "pub", "pub(crate)", "pub(super)", "private", etc.
    pub location: [u32; 2], // [start_byte, end_byte]
    pub details: ItemDetails,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub enum ItemDetails {
    Function(FunctionDetails),
    Adt(AdtDetails), // Algebraic Data Type (struct, enum, union)
    Trait(TraitDetails),
    Module(ModuleDetails),
    Other(OtherDetails),
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct FunctionDetails {
    pub signature: String,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct AdtDetails {
    pub adt_type: String,       // "struct", "enum", "union"
    pub methods: Vec<ItemInfo>, // Methods from impl blocks
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct TraitDetails {
    pub methods: Vec<TraitMethodInfo>,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct ModuleDetails {
    pub items: Vec<ItemInfo>, // Items within the inline module
    pub module_references: Vec<ModuleReference>, // Module references within this module
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct OtherDetails {
    pub item_type: String,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct TraitMethodInfo {
    pub name: String,
    pub signature: String,
    pub doc_comment: Option<String>,
    pub location: [u32; 2], // [start_byte, end_byte]
}

// Removed SourceLocation struct - using [u32; 2] for byte offsets

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct ParseError {
    pub message: String,
    pub severity: String,
    pub location: Option<[u32; 2]>, // [start_byte, end_byte]
}

pub fn parse_rust_code(code: &str, include_private: bool) -> Result<ParseResponse, String> {
    let parsed = SourceFile::parse(code, ra_ap_syntax::Edition::Edition2024);
    let _syntax_node = parsed.syntax_node();

    // Extract errors
    let errors: Vec<ParseError> = parsed
        .errors()
        .iter()
        .map(|e| {
            tracing::warn!("Parse error: {e}");
            ParseError {
                message: e.to_string(),
                severity: "error".to_string(),
                location: None, // TODO: Extract location from error
            }
        })
        .collect();

    // Extract file information
    let source_file = parsed.tree();
    let file_info = extract_file_info(&source_file, code, include_private);

    Ok(ParseResponse {
        success: errors.is_empty(),
        parse_time: 100,
        file_info: Some(file_info),
        errors,
    })
}

fn extract_file_info(
    source_file: &SourceFile,
    full_source: &str,
    include_private: bool,
) -> FileInfo {
    let mut items = Vec::new();
    let mut module_references = Vec::new();

    for item in source_file.items() {
        match &item {
            ast::Item::Module(module) => {
                if should_include_item(module.visibility(), include_private) {
                    if let Some(name) = module.name() {
                        let module_name = name.text().to_string();
                        let location = text_range_to_byte_offsets(module.syntax().text_range());

                        if module.item_list().is_some() {
                            // Inline module: mod foo { ... } - treat as regular item
                            if let Some(item_info) =
                                extract_item_info(item.clone(), full_source, include_private)
                            {
                                items.push(item_info);
                            }
                        } else {
                            // Module reference: mod foo;
                            let expected_paths = vec![
                                format!("{}.rs", module_name),
                                format!("{}/mod.rs", module_name),
                            ];

                            module_references.push(ModuleReference {
                                name: module_name,
                                visibility: extract_visibility(module.visibility()),
                                expected_paths,
                                location,
                            });
                        }
                    }
                }
            }
            _ => {
                // Check visibility before including item
                if should_include_item(get_item_visibility(&item), include_private) {
                    if let Some(item_info) =
                        extract_item_info(item.clone(), full_source, include_private)
                    {
                        items.push(item_info);
                    }
                }
            }
        }
    }

    FileInfo {
        items,
        module_references,
    }
}

fn extract_module_info(
    module: &ast::Module,
    full_source: &str,
    include_private: bool,
) -> Option<ItemInfo> {
    let name = module.name()?.text().to_string();
    let syntax = module.syntax();
    let full_code = syntax.text().to_string();
    let location = text_range_to_byte_offsets(syntax.text_range());
    let doc_comment = extract_doc_comment(module);
    let visibility = extract_visibility(module.visibility());

    // Only handle inline modules here (mod foo { ... })
    if let Some(item_list) = module.item_list() {
        let mut items = Vec::new();
        let mut module_references = Vec::new();

        for item in item_list.items() {
            match &item {
                ast::Item::Module(nested_module) => {
                    if should_include_item(nested_module.visibility(), include_private) {
                        if let Some(nested_name) = nested_module.name() {
                            let nested_location =
                                text_range_to_byte_offsets(nested_module.syntax().text_range());

                            if nested_module.item_list().is_some() {
                                // Nested inline module
                                if let Some(nested_item) =
                                    extract_item_info(item.clone(), full_source, include_private)
                                {
                                    items.push(nested_item);
                                }
                            } else {
                                // Nested module reference
                                let nested_name_str = nested_name.text().to_string();
                                let expected_paths = vec![
                                    format!("{}/{}.rs", name, nested_name_str),
                                    format!("{}/{}/mod.rs", name, nested_name_str),
                                ];

                                module_references.push(ModuleReference {
                                    name: nested_name_str,
                                    visibility: extract_visibility(nested_module.visibility()),
                                    expected_paths,
                                    location: nested_location,
                                });
                            }
                        }
                    }
                }
                _ => {
                    // Check visibility before including item
                    if should_include_item(get_item_visibility(&item), include_private) {
                        if let Some(item_info) =
                            extract_item_info(item.clone(), full_source, include_private)
                        {
                            items.push(item_info);
                        }
                    }
                }
            }
        }

        Some(ItemInfo {
            name,
            full_code,
            doc_comment,
            visibility,
            location,
            details: ItemDetails::Module(ModuleDetails {
                items,
                module_references,
            }),
        })
    } else {
        // Module reference (mod foo;) - shouldn't be handled here
        None
    }
}

fn should_include_item(vis: Option<ast::Visibility>, include_private: bool) -> bool {
    if include_private {
        true
    } else {
        match vis {
            Some(v) => v.syntax().text().to_string().contains("pub"),
            None => false,
        }
    }
}

fn get_item_visibility(item: &ast::Item) -> Option<ast::Visibility> {
    match item {
        ast::Item::Fn(f) => f.visibility(),
        ast::Item::Struct(s) => s.visibility(),
        ast::Item::Enum(e) => e.visibility(),
        ast::Item::Trait(t) => t.visibility(),
        ast::Item::Module(m) => m.visibility(),
        ast::Item::Use(u) => u.visibility(),
        ast::Item::Const(c) => c.visibility(),
        ast::Item::Static(s) => s.visibility(),
        ast::Item::TypeAlias(t) => t.visibility(),
        ast::Item::Impl(_) => None, // impl blocks don't have visibility
        _ => None,
    }
}

fn extract_item_info(
    item: ast::Item,
    full_source: &str,
    include_private: bool,
) -> Option<ItemInfo> {
    match item {
        ast::Item::Fn(func) => extract_function_info(func, full_source, include_private),
        ast::Item::Struct(_) => {
            extract_adt_info(item.clone(), "struct", full_source, include_private)
        }
        ast::Item::Enum(_) => extract_adt_info(item.clone(), "enum", full_source, include_private),
        ast::Item::Union(_) => {
            extract_adt_info(item.clone(), "union", full_source, include_private)
        }
        ast::Item::Trait(t) => extract_trait_info(t, full_source, include_private),
        ast::Item::Module(m) => extract_module_info(&m, full_source, include_private),
        other => extract_other_item_info(other, full_source, include_private),
    }
}

fn extract_function_info(
    func: ast::Fn,
    _full_source: &str,
    _include_private: bool,
) -> Option<ItemInfo> {
    let name = func.name()?.text().to_string();
    let syntax = func.syntax();
    let full_code = syntax.text().to_string();
    let location = text_range_to_byte_offsets(syntax.text_range());
    let doc_comment = extract_doc_comment(&func);

    // Extract function signature (everything before the body)
    let signature = if let Some(body) = func.body() {
        let body_start = body.syntax().text_range().start();
        let func_start = syntax.text_range().start();
        let signature_end = (body_start - func_start).into();
        full_code[..signature_end].trim_end().to_string()
    } else {
        // No body (trait method declaration)
        full_code.clone()
    };

    Some(ItemInfo {
        name,
        full_code,
        doc_comment,
        visibility: extract_visibility(func.visibility()),
        location,
        details: ItemDetails::Function(FunctionDetails { signature }),
    })
}

fn extract_adt_info(
    item: ast::Item,
    adt_type: &str,
    full_source: &str,
    include_private: bool,
) -> Option<ItemInfo> {
    let (name, syntax, doc_comment, visibility) = match &item {
        ast::Item::Struct(s) => (
            s.name()?.text().to_string(),
            s.syntax(),
            extract_doc_comment(s),
            extract_visibility(s.visibility()),
        ),
        ast::Item::Enum(e) => (
            e.name()?.text().to_string(),
            e.syntax(),
            extract_doc_comment(e),
            extract_visibility(e.visibility()),
        ),
        ast::Item::Union(u) => (
            u.name()?.text().to_string(),
            u.syntax(),
            extract_doc_comment(u),
            extract_visibility(u.visibility()),
        ),
        _ => return None,
    };

    let full_code = syntax.text().to_string();
    let location = text_range_to_byte_offsets(syntax.text_range());

    // Find impl blocks for this ADT in the source file
    let methods = extract_adt_methods(&name, full_source, include_private);

    Some(ItemInfo {
        name,
        full_code,
        doc_comment,
        visibility,
        location,
        details: ItemDetails::Adt(AdtDetails {
            adt_type: adt_type.to_string(),
            methods,
        }),
    })
}

fn extract_other_item_info(
    item: ast::Item,
    _full_source: &str,
    _include_private: bool,
) -> Option<ItemInfo> {
    let syntax = item.syntax();
    let full_code = syntax.text().to_string();
    let location = text_range_to_byte_offsets(syntax.text_range());
    let doc_comment = None; // Other items don't implement HasDocComments uniformly

    let (name, item_type) = match &item {
        // Enums are now handled as ADTs
        ast::Item::Use(u) => (u.use_tree()?.syntax().text().to_string(), "use".to_string()),
        ast::Item::Const(c) => (c.name()?.text().to_string(), "const".to_string()),
        ast::Item::Static(s) => (s.name()?.text().to_string(), "static".to_string()),
        ast::Item::TypeAlias(t) => (t.name()?.text().to_string(), "type_alias".to_string()),
        ast::Item::Impl(i) => {
            let impl_type = i.self_ty()?.syntax().text().to_string();
            let trait_name = i.trait_().map(|t| t.syntax().text().to_string());
            let name = trait_name
                .as_ref()
                .map(|t| format!("{t} for {impl_type}"))
                .unwrap_or(impl_type);
            (name, "impl".to_string())
        }
        _ => ("unknown".to_string(), "unknown".to_string()),
    };

    Some(ItemInfo {
        name,
        full_code,
        doc_comment,
        visibility: extract_item_visibility(&item),
        location,
        details: ItemDetails::Other(OtherDetails { item_type }),
    })
}

fn extract_trait_methods(trait_item: &ast::Trait, _full_source: &str) -> Vec<TraitMethodInfo> {
    let mut methods = Vec::new();

    if let Some(assoc_item_list) = trait_item.assoc_item_list() {
        for item in assoc_item_list.assoc_items() {
            if let ast::AssocItem::Fn(func) = item {
                if let Some(name) = func.name() {
                    let syntax = func.syntax();
                    let location = text_range_to_byte_offsets(syntax.text_range());
                    let doc_comment = extract_doc_comment(&func);

                    // Extract just the signature (everything before the body if it exists)
                    let signature = if let Some(body) = func.body() {
                        let body_start = body.syntax().text_range().start();
                        let func_start = syntax.text_range().start();
                        let signature_end = (body_start - func_start).into();
                        let full_text = syntax.text().to_string();
                        full_text[..signature_end].trim_end().to_string()
                    } else {
                        syntax.text().to_string()
                    };

                    methods.push(TraitMethodInfo {
                        name: name.text().to_string(),
                        signature,
                        doc_comment,
                        location,
                    });
                }
            }
        }
    }

    methods
}

fn extract_adt_methods(adt_name: &str, full_source: &str, include_private: bool) -> Vec<ItemInfo> {
    let mut methods = Vec::new();

    // Parse the full source to find impl blocks for this struct
    let parsed = SourceFile::parse(full_source, ra_ap_syntax::Edition::Edition2024);
    let source_file = parsed.tree();

    for item in source_file.items() {
        if let ast::Item::Impl(impl_item) = item {
            if let Some(self_ty) = impl_item.self_ty() {
                let impl_type = self_ty.syntax().text().to_string();
                // Simple name matching - could be improved for generic types
                if impl_type.contains(adt_name) {
                    if let Some(assoc_item_list) = impl_item.assoc_item_list() {
                        for assoc_item in assoc_item_list.assoc_items() {
                            if let ast::AssocItem::Fn(func) = assoc_item {
                                if should_include_item(func.visibility(), include_private) {
                                    if let Some(func_info) =
                                        extract_function_info(func, full_source, include_private)
                                    {
                                        methods.push(func_info);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    methods
}

fn extract_item_visibility(item: &ast::Item) -> String {
    let vis = match item {
        ast::Item::Fn(f) => f.visibility(),
        ast::Item::Struct(s) => s.visibility(),
        ast::Item::Enum(e) => e.visibility(),
        ast::Item::Trait(t) => t.visibility(),
        ast::Item::Module(m) => m.visibility(),
        ast::Item::Use(u) => u.visibility(),
        ast::Item::Const(c) => c.visibility(),
        ast::Item::Static(s) => s.visibility(),
        ast::Item::TypeAlias(t) => t.visibility(),
        ast::Item::Impl(_) => None, // impl blocks don't have visibility
        _ => None,
    };
    extract_visibility(vis)
}

fn extract_trait_info(
    t: ast::Trait,
    _full_source: &str,
    _include_private: bool,
) -> Option<ItemInfo> {
    let name = t.name()?.text().to_string();
    let syntax = t.syntax();
    let full_code = syntax.text().to_string();
    let location = text_range_to_byte_offsets(syntax.text_range());
    let doc_comment = extract_doc_comment(&t);

    // Extract trait methods
    let methods = extract_trait_methods(&t, _full_source);

    Some(ItemInfo {
        name,
        full_code,
        doc_comment,
        visibility: extract_visibility(t.visibility()),
        location,
        details: ItemDetails::Trait(TraitDetails { methods }),
    })
}

// We no longer extract impl blocks as separate items since they're part of struct methods

// Removed - modules handled separately in FileInfo

// We no longer extract use statements as they're not in our focus

// We no longer extract const items as they're not in our focus

// We no longer extract static items as they're not in our focus

// We no longer extract type aliases as they're not in our focus

fn extract_visibility(vis: Option<ast::Visibility>) -> String {
    match vis {
        Some(v) => {
            let text = v.syntax().text().to_string();
            if text.contains("pub(crate)") {
                "pub(crate)".to_string()
            } else if text.contains("pub(super)") {
                "pub(super)".to_string()
            } else if text.contains("pub(in") {
                "pub(in path)".to_string()
            } else if text.contains("pub") {
                "pub".to_string()
            } else {
                "private".to_string()
            }
        }
        None => "private".to_string(),
    }
}

// Removed old extraction functions that are no longer needed

// Removed old attribute extraction function

fn text_range_to_byte_offsets(range: TextRange) -> [u32; 2] {
    [range.start().into(), range.end().into()]
}

fn extract_doc_comment<T: HasDocComments>(node: &T) -> Option<String> {
    let docs: Vec<String> = node
        .doc_comments()
        .map(|comment| comment.text().trim_start_matches("///").trim().to_string())
        .collect();

    if docs.is_empty() {
        None
    } else {
        Some(docs.join("\n"))
    }
}

// Removed extract_attributes_from_syntax - no longer needed with HasDocComments
