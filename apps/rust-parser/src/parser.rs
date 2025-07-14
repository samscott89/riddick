use ra_ap_syntax::{
    ast::{self, HasModuleItem, HasName, HasVisibility},
    AstNode, SourceFile, TextRange,
};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct ParseRequest {
    pub code: String,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct ParseResponse {
    pub success: bool,
    pub parse_time: u64,
    pub crate_info: Option<CrateInfo>,
    pub errors: Vec<ParseError>,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct CrateInfo {
    pub name: String,
    pub modules: Vec<ModuleInfo>,
    pub root_module: ModuleInfo,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct ModuleInfo {
    pub name: String,
    pub path: String,
    pub items: Vec<ItemInfo>,
    pub location: [u32; 2], // [start_byte, end_byte]
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct ItemInfo {
    pub name: String,
    pub full_code: String,
    pub doc_comment: Option<String>,
    pub location: [u32; 2], // [start_byte, end_byte]
    pub details: ItemDetails,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub enum ItemDetails {
    Function(FunctionDetails),
    Struct(StructDetails),
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
pub struct StructDetails {
    pub methods: Vec<ItemInfo>,
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
    pub items: Vec<ItemInfo>,
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

pub fn parse_rust_code(code: &str) -> Result<ParseResponse, String> {
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

    // Extract module information
    let source_file = parsed.tree();
    let root_module = extract_module_info(&source_file, "main", "main.rs", code);
    
    // Collect all modules recursively
    let mut all_modules = vec![root_module.clone()];
    collect_modules_recursive(&source_file, "main", &mut all_modules, code);

    let crate_info = CrateInfo {
        name: "unnamed".to_string(),
        modules: all_modules,
        root_module,
    };

    Ok(ParseResponse {
        success: errors.is_empty(),
        parse_time: 100,
        crate_info: Some(crate_info),
        errors,
    })
}

fn extract_module_info(source_file: &SourceFile, name: &str, path: &str, full_source: &str) -> ModuleInfo {
    let mut items = Vec::new();

    for item in source_file.items() {
        // Only include public items
        let is_public = match &item {
            ast::Item::Fn(f) => is_item_public(f.visibility()),
            ast::Item::Struct(s) => is_item_public(s.visibility()),
            ast::Item::Enum(e) => is_item_public(e.visibility()),
            ast::Item::Trait(t) => is_item_public(t.visibility()),
            ast::Item::Module(m) => is_item_public(m.visibility()),
            ast::Item::Use(u) => is_item_public(u.visibility()),
            ast::Item::Const(c) => is_item_public(c.visibility()),
            ast::Item::Static(s) => is_item_public(s.visibility()),
            ast::Item::TypeAlias(t) => is_item_public(t.visibility()),
            _ => false,
        };
        
        if is_public {
            if let Some(item_info) = extract_item_info(item, full_source) {
                items.push(item_info);
            }
        }
    }

    let syntax = source_file.syntax();
    let location = text_range_to_byte_offsets(syntax.text_range());

    ModuleInfo {
        name: name.to_string(),
        path: path.to_string(),
        items,
        location,
    }
}

fn is_item_public(vis: Option<ast::Visibility>) -> bool {
    match vis {
        Some(v) => v.syntax().text().to_string().contains("pub"),
        None => false,
    }
}

fn collect_modules_recursive(source_file: &SourceFile, parent_path: &str, modules: &mut Vec<ModuleInfo>, full_source: &str) {
    for item in source_file.items() {
        if let ast::Item::Module(module) = item {
            if is_item_public(module.visibility()) {
                if let Some(name) = module.name() {
                    let module_name = name.text().to_string();
                    let module_path = format!("{parent_path}::{module_name}");
                    
                    // Process inline modules
                    if let Some(item_list) = module.item_list() {
                        let mut module_items = Vec::new();
                        
                        for item in item_list.items() {
                            let is_public = match &item {
                                ast::Item::Fn(f) => is_item_public(f.visibility()),
                                ast::Item::Struct(s) => is_item_public(s.visibility()),
                                ast::Item::Enum(e) => is_item_public(e.visibility()),
                                ast::Item::Trait(t) => is_item_public(t.visibility()),
                                ast::Item::Module(m) => is_item_public(m.visibility()),
                                ast::Item::Use(u) => is_item_public(u.visibility()),
                                ast::Item::Const(c) => is_item_public(c.visibility()),
                                ast::Item::Static(s) => is_item_public(s.visibility()),
                                ast::Item::TypeAlias(t) => is_item_public(t.visibility()),
                                _ => false,
                            };
                            
                            if is_public {
                                if let Some(item_info) = extract_item_info(item.clone(), full_source) {
                                    module_items.push(item_info);
                                }
                            }
                            
                            // Recursively process submodules
                            if let ast::Item::Module(submodule) = item {
                                if is_item_public(submodule.visibility()) {
                                    if let Some(submodule_name) = submodule.name() {
                                        let submodule_path = format!("{module_path}::{}", submodule_name.text());
                                        if let Some(submodule_items) = submodule.item_list() {
                                            collect_module_items_recursive(&submodule_items, &submodule_path, modules, full_source);
                                        }
                                    }
                                }
                            }
                        }
                        
                        let syntax = module.syntax();
                        let location = text_range_to_byte_offsets(syntax.text_range());
                        
                        modules.push(ModuleInfo {
                            name: module_name,
                            path: module_path,
                            items: module_items,
                            location,
                        });
                    }
                }
            }
        }
    }
}

fn collect_module_items_recursive(item_list: &ast::ItemList, parent_path: &str, modules: &mut Vec<ModuleInfo>, full_source: &str) {
    for item in item_list.items() {
        if let ast::Item::Module(module) = item {
            if is_item_public(module.visibility()) {
                if let Some(name) = module.name() {
                    let module_name = name.text().to_string();
                    let module_path = format!("{parent_path}::{module_name}");
                    
                    if let Some(item_list) = module.item_list() {
                        let mut module_items = Vec::new();
                        
                        for item in item_list.items() {
                            let is_public = match &item {
                                ast::Item::Fn(f) => is_item_public(f.visibility()),
                                ast::Item::Struct(s) => is_item_public(s.visibility()),
                                ast::Item::Enum(e) => is_item_public(e.visibility()),
                                ast::Item::Trait(t) => is_item_public(t.visibility()),
                                ast::Item::Module(m) => is_item_public(m.visibility()),
                                ast::Item::Use(u) => is_item_public(u.visibility()),
                                ast::Item::Const(c) => is_item_public(c.visibility()),
                                ast::Item::Static(s) => is_item_public(s.visibility()),
                                ast::Item::TypeAlias(t) => is_item_public(t.visibility()),
                                _ => false,
                            };
                            
                            if is_public {
                                if let Some(item_info) = extract_item_info(item.clone(), full_source) {
                                    module_items.push(item_info);
                                }
                            }
                        }
                        
                        let syntax = module.syntax();
                        let location = text_range_to_byte_offsets(syntax.text_range());
                        
                        modules.push(ModuleInfo {
                            name: module_name.clone(),
                            path: module_path.clone(),
                            items: module_items,
                            location,
                        });
                        
                        // Recursively process nested modules
                        collect_module_items_recursive(&item_list, &module_path, modules, full_source);
                    }
                }
            }
        }
    }
}

fn extract_item_info(item: ast::Item, full_source: &str) -> Option<ItemInfo> {
    match item {
        ast::Item::Fn(func) => extract_function_info(func, full_source),
        ast::Item::Struct(s) => extract_struct_info(s, full_source),
        ast::Item::Trait(t) => extract_trait_info(t, full_source),
        ast::Item::Module(m) => extract_module_item_info(m, full_source),
        other => extract_other_item_info(other, full_source),
    }
}

fn extract_function_info(func: ast::Fn, full_source: &str) -> Option<ItemInfo> {
    let name = func.name()?.text().to_string();
    let syntax = func.syntax();
    let full_code = syntax.text().to_string();
    let location = text_range_to_byte_offsets(syntax.text_range());
    let doc_comment = extract_doc_comment(syntax, full_source);
    
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
        location,
        details: ItemDetails::Function(FunctionDetails { signature }),
    })
}

fn extract_struct_info(s: ast::Struct, full_source: &str) -> Option<ItemInfo> {
    let name = s.name()?.text().to_string();
    let syntax = s.syntax();
    let full_code = syntax.text().to_string();
    let location = text_range_to_byte_offsets(syntax.text_range());
    let doc_comment = extract_doc_comment(syntax, full_source);
    
    // Find impl blocks for this struct in the source file
    let methods = extract_struct_methods(&name, full_source);

    Some(ItemInfo {
        name,
        full_code,
        doc_comment,
        location,
        details: ItemDetails::Struct(StructDetails { methods }),
    })
}

fn extract_other_item_info(item: ast::Item, full_source: &str) -> Option<ItemInfo> {
    let syntax = item.syntax();
    let full_code = syntax.text().to_string();
    let location = text_range_to_byte_offsets(syntax.text_range());
    let doc_comment = extract_doc_comment(syntax, full_source);
    
    let (name, item_type) = match &item {
        ast::Item::Enum(e) => (e.name()?.text().to_string(), "enum".to_string()),
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
        location,
        details: ItemDetails::Other(OtherDetails { item_type }),
    })
}

fn extract_trait_methods(trait_item: &ast::Trait, full_source: &str) -> Vec<TraitMethodInfo> {
    let mut methods = Vec::new();
    
    if let Some(assoc_item_list) = trait_item.assoc_item_list() {
        for item in assoc_item_list.assoc_items() {
            if let ast::AssocItem::Fn(func) = item {
                if let Some(name) = func.name() {
                    let syntax = func.syntax();
                    let location = text_range_to_byte_offsets(syntax.text_range());
                    let doc_comment = extract_doc_comment(syntax, full_source);
                    
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

fn extract_struct_methods(struct_name: &str, full_source: &str) -> Vec<ItemInfo> {
    let mut methods = Vec::new();
    
    // Parse the full source to find impl blocks for this struct
    let parsed = SourceFile::parse(full_source, ra_ap_syntax::Edition::Edition2024);
    let source_file = parsed.tree();
    
    for item in source_file.items() {
        if let ast::Item::Impl(impl_item) = item {
            if let Some(self_ty) = impl_item.self_ty() {
                let impl_type = self_ty.syntax().text().to_string();
                // Simple name matching - could be improved for generic types
                if impl_type.contains(struct_name) {
                    if let Some(assoc_item_list) = impl_item.assoc_item_list() {
                        for assoc_item in assoc_item_list.assoc_items() {
                            if let ast::AssocItem::Fn(func) = assoc_item {
                                if is_item_public(func.visibility()) {
                                    if let Some(func_info) = extract_function_info(func, full_source) {
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

fn extract_trait_info(t: ast::Trait, full_source: &str) -> Option<ItemInfo> {
    let name = t.name()?.text().to_string();
    let syntax = t.syntax();
    let full_code = syntax.text().to_string();
    let location = text_range_to_byte_offsets(syntax.text_range());
    let doc_comment = extract_doc_comment(syntax, full_source);
    
    // Extract trait methods
    let methods = extract_trait_methods(&t, full_source);

    Some(ItemInfo {
        name,
        full_code,
        doc_comment,
        location,
        details: ItemDetails::Trait(TraitDetails { methods }),
    })
}

// We no longer extract impl blocks as separate items since they're part of struct methods

fn extract_module_item_info(m: ast::Module, full_source: &str) -> Option<ItemInfo> {
    let name = m.name()?.text().to_string();
    let syntax = m.syntax();
    let full_code = syntax.text().to_string();
    let location = text_range_to_byte_offsets(syntax.text_range());
    let doc_comment = extract_doc_comment(syntax, full_source);
    
    // Extract nested items from the module
    let mut items = Vec::new();
    if let Some(item_list) = m.item_list() {
        for item in item_list.items() {
            if is_item_public(get_item_visibility(&item)) {
                if let Some(item_info) = extract_item_info(item, full_source) {
                    items.push(item_info);
                }
            }
        }
    }

    Some(ItemInfo {
        name,
        full_code,
        doc_comment,
        location,
        details: ItemDetails::Module(ModuleDetails { items }),
    })
}

// We no longer extract use statements as they're not in our focus

// We no longer extract const items as they're not in our focus

// We no longer extract static items as they're not in our focus

// We no longer extract type aliases as they're not in our focus

// Removed unused extract_visibility function

// Removed old extraction functions that are no longer needed

// Removed old attribute extraction function

fn text_range_to_byte_offsets(range: TextRange) -> [u32; 2] {
    [range.start().into(), range.end().into()]
}

fn extract_doc_comment(syntax: &ra_ap_syntax::SyntaxNode, full_source: &str) -> Option<String> {
    let mut doc_lines = Vec::new();
    
    // Look at the full source around this item
    let range = syntax.text_range();
    let start_offset = range.start().into();
    
    // Look backwards in the source for doc comments
    let lines: Vec<&str> = full_source[..start_offset].lines().collect();
    for line in lines.iter().rev() {
        let trimmed = line.trim();
        if trimmed.starts_with("///") {
            let content = trimmed.trim_start_matches("///").trim();
            doc_lines.insert(0, content.to_string());
        } else if trimmed.is_empty() {
            // Empty line, might have more doc comments above
            continue;
        } else {
            // Non-doc line, stop looking
            break;
        }
    }
    
    // Also check for doc attributes like #[doc = "..."]  
    for attr_text in extract_attributes_from_syntax(syntax) {
        if attr_text.starts_with("#[doc") {
            // Simple extraction of doc attribute content
            if let Some(start) = attr_text.find('"') {
                if let Some(end) = attr_text.rfind('"') {
                    if start < end {
                        doc_lines.push(attr_text[start + 1..end].to_string());
                    }
                }
            }
        }
    }
    
    if doc_lines.is_empty() {
        None
    } else {
        Some(doc_lines.join("\n"))
    }
}

fn extract_attributes_from_syntax(syntax: &ra_ap_syntax::SyntaxNode) -> Vec<String> {
    let mut attributes = Vec::new();
    
    // Look for attribute nodes that are siblings before this node
    let mut current = syntax.clone();
    while let Some(prev) = current.prev_sibling() {
        current = prev;
        if let Some(attr) = ast::Attr::cast(current.clone()) {
            attributes.push(attr.syntax().text().to_string());
        } else if !current.kind().is_trivia() {
            // Stop if we hit a non-trivia, non-attribute node
            break;
        }
    }
    
    attributes.reverse();
    attributes
}
