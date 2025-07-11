use wasm_bindgen::prelude::*;
use ra_ap_syntax::{
    ast::{self, HasModuleItem, HasName, HasVisibility, HasGenericParams},
    AstNode, SourceFile, TextRange,
};
use serde::{Serialize, Deserialize};

// Initialize panic hook for better error messages in WASM
#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParseRequest {
    pub code: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParseResponse {
    pub success: bool,
    pub parse_time: u64,
    pub crate_info: Option<CrateInfo>,
    pub errors: Vec<ParseError>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CrateInfo {
    pub name: String,
    pub modules: Vec<ModuleInfo>,
    pub root_module: ModuleInfo,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleInfo {
    pub name: String,
    pub path: String,
    pub items: Vec<ItemInfo>,
    pub location: SourceLocation,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemInfo {
    #[serde(rename = "type")]
    pub item_type: String,
    pub name: String,
    pub visibility: String,
    pub location: SourceLocation,
    pub source_code: String,
    pub attributes: Vec<String>,
    pub generic_parameters: Vec<String>,
    
    // Function-specific fields
    pub parameters: Option<Vec<ParameterInfo>>,
    pub return_type: Option<String>,
    
    // Struct-specific fields
    pub fields: Option<Vec<FieldInfo>>,
    
    // Enum-specific fields
    pub variants: Option<Vec<VariantInfo>>,
    
    // Impl-specific fields
    pub impl_type: Option<String>,
    pub trait_name: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParameterInfo {
    pub name: String,
    pub param_type: String,
    pub is_self: bool,
    pub is_mutable: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldInfo {
    pub name: String,
    pub field_type: String,
    pub visibility: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VariantInfo {
    pub name: String,
    pub discriminant: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceLocation {
    pub start_line: u32,
    pub start_column: u32,
    pub end_line: u32,
    pub end_column: u32,
    pub start_byte: u32,
    pub end_byte: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParseError {
    pub message: String,
    pub severity: String,
    pub location: Option<SourceLocation>,
}

#[wasm_bindgen]
pub fn parse_rust_code(code: &str) -> Result<JsValue, JsValue> {
    let parsed = SourceFile::parse(code, ra_ap_syntax::Edition::Edition2024);
    let _syntax_node = parsed.syntax_node();
    
    // Extract errors
    let errors: Vec<ParseError> = parsed
        .errors()
        .iter()
        .map(|e| ParseError {
            message: e.to_string(),
            severity: "error".to_string(),
            location: None, // TODO: Extract location from error
        })
        .collect();
    
    // Extract module information
    let source_file = parsed.tree();
    let root_module = extract_module_info(&source_file, "main", "main.rs");
    
    let crate_info = CrateInfo {
        name: "unnamed".to_string(),
        modules: vec![root_module.clone()],
        root_module,
    };
    
    let response = ParseResponse {
        success: errors.is_empty(),
        parse_time: 1, // Fixed for WASM compatibility
        crate_info: Some(crate_info),
        errors,
    };
    
    // Convert to JsValue using serde-wasm-bindgen
    serde_wasm_bindgen::to_value(&response)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

fn extract_module_info(source_file: &SourceFile, name: &str, path: &str) -> ModuleInfo {
    let mut items = Vec::new();
    
    for item in source_file.items() {
        if let Some(item_info) = extract_item_info(item) {
            items.push(item_info);
        }
    }
    
    let syntax = source_file.syntax();
    let location = text_range_to_location(syntax.text_range(), &syntax.text().to_string());
    
    ModuleInfo {
        name: name.to_string(),
        path: path.to_string(),
        items,
        location,
    }
}

fn extract_item_info(item: ast::Item) -> Option<ItemInfo> {
    match item {
        ast::Item::Fn(func) => extract_function_info(func),
        ast::Item::Struct(s) => extract_struct_info(s),
        ast::Item::Enum(e) => extract_enum_info(e),
        ast::Item::Trait(t) => extract_trait_info(t),
        ast::Item::Impl(i) => extract_impl_info(i),
        ast::Item::Module(m) => extract_module_item_info(m),
        ast::Item::Use(u) => extract_use_info(u),
        ast::Item::Const(c) => extract_const_info(c),
        ast::Item::Static(s) => extract_static_info(s),
        ast::Item::TypeAlias(t) => extract_type_alias_info(t),
        _ => None,
    }
}

fn extract_function_info(func: ast::Fn) -> Option<ItemInfo> {
    let name = func.name()?.text().to_string();
    let visibility = extract_visibility(func.visibility());
    let syntax = func.syntax();
    let source_code = syntax.text().to_string();
    let location = text_range_to_location(syntax.text_range(), &source_code);
    
    let parameters = extract_parameters(&func);
    let return_type = func.ret_type().map(|rt| rt.syntax().text().to_string());
    let generic_parameters = extract_generic_params(func.generic_param_list());
    let attributes = extract_attributes(&func);
    
    Some(ItemInfo {
        item_type: "function".to_string(),
        name,
        visibility,
        location,
        source_code,
        attributes,
        generic_parameters,
        parameters: Some(parameters),
        return_type,
        fields: None,
        variants: None,
        impl_type: None,
        trait_name: None,
    })
}

fn extract_struct_info(s: ast::Struct) -> Option<ItemInfo> {
    let name = s.name()?.text().to_string();
    let visibility = extract_visibility(s.visibility());
    let syntax = s.syntax();
    let source_code = syntax.text().to_string();
    let location = text_range_to_location(syntax.text_range(), &source_code);
    
    let fields = extract_struct_fields(&s);
    let generic_parameters = extract_generic_params(s.generic_param_list());
    let attributes = extract_attributes(&s);
    
    Some(ItemInfo {
        item_type: "struct".to_string(),
        name,
        visibility,
        location,
        source_code,
        attributes,
        generic_parameters,
        parameters: None,
        return_type: None,
        fields: Some(fields),
        variants: None,
        impl_type: None,
        trait_name: None,
    })
}

fn extract_enum_info(e: ast::Enum) -> Option<ItemInfo> {
    let name = e.name()?.text().to_string();
    let visibility = extract_visibility(e.visibility());
    let syntax = e.syntax();
    let source_code = syntax.text().to_string();
    let location = text_range_to_location(syntax.text_range(), &source_code);
    
    let variants = extract_enum_variants(&e);
    let generic_parameters = extract_generic_params(e.generic_param_list());
    let attributes = extract_attributes(&e);
    
    Some(ItemInfo {
        item_type: "enum".to_string(),
        name,
        visibility,
        location,
        source_code,
        attributes,
        generic_parameters,
        parameters: None,
        return_type: None,
        fields: None,
        variants: Some(variants),
        impl_type: None,
        trait_name: None,
    })
}

fn extract_trait_info(t: ast::Trait) -> Option<ItemInfo> {
    let name = t.name()?.text().to_string();
    let visibility = extract_visibility(t.visibility());
    let syntax = t.syntax();
    let source_code = syntax.text().to_string();
    let location = text_range_to_location(syntax.text_range(), &source_code);
    
    let generic_parameters = extract_generic_params(t.generic_param_list());
    let attributes = extract_attributes(&t);
    
    Some(ItemInfo {
        item_type: "trait".to_string(),
        name,
        visibility,
        location,
        source_code,
        attributes,
        generic_parameters,
        parameters: None,
        return_type: None,
        fields: None,
        variants: None,
        impl_type: None,
        trait_name: None,
    })
}

fn extract_impl_info(i: ast::Impl) -> Option<ItemInfo> {
    let impl_type = i.self_ty()?.syntax().text().to_string();
    let trait_name = i.trait_().map(|t| t.syntax().text().to_string());
    let name = trait_name.as_ref()
        .map(|t| format!("{} for {}", t, impl_type))
        .unwrap_or(impl_type.clone());
    
    let syntax = i.syntax();
    let source_code = syntax.text().to_string();
    let location = text_range_to_location(syntax.text_range(), &source_code);
    
    let generic_parameters = extract_generic_params(i.generic_param_list());
    let attributes = extract_attributes(&i);
    
    Some(ItemInfo {
        item_type: "impl".to_string(),
        name,
        visibility: "private".to_string(),
        location,
        source_code,
        attributes,
        generic_parameters,
        parameters: None,
        return_type: None,
        fields: None,
        variants: None,
        impl_type: Some(impl_type),
        trait_name,
    })
}

fn extract_module_item_info(m: ast::Module) -> Option<ItemInfo> {
    let name = m.name()?.text().to_string();
    let visibility = extract_visibility(m.visibility());
    let syntax = m.syntax();
    let source_code = syntax.text().to_string();
    let location = text_range_to_location(syntax.text_range(), &source_code);
    let attributes = extract_attributes(&m);
    
    Some(ItemInfo {
        item_type: "mod".to_string(),
        name,
        visibility,
        location,
        source_code,
        attributes,
        generic_parameters: vec![],
        parameters: None,
        return_type: None,
        fields: None,
        variants: None,
        impl_type: None,
        trait_name: None,
    })
}

fn extract_use_info(u: ast::Use) -> Option<ItemInfo> {
    let syntax = u.syntax();
    let source_code = syntax.text().to_string();
    let location = text_range_to_location(syntax.text_range(), &source_code);
    let visibility = extract_visibility(u.visibility());
    let attributes = extract_attributes(&u);
    
    // Extract the use path
    let name = u.use_tree()?.syntax().text().to_string();
    
    Some(ItemInfo {
        item_type: "use".to_string(),
        name,
        visibility,
        location,
        source_code,
        attributes,
        generic_parameters: vec![],
        parameters: None,
        return_type: None,
        fields: None,
        variants: None,
        impl_type: None,
        trait_name: None,
    })
}

fn extract_const_info(c: ast::Const) -> Option<ItemInfo> {
    let name = c.name()?.text().to_string();
    let visibility = extract_visibility(c.visibility());
    let syntax = c.syntax();
    let source_code = syntax.text().to_string();
    let location = text_range_to_location(syntax.text_range(), &source_code);
    let attributes = extract_attributes(&c);
    
    Some(ItemInfo {
        item_type: "const".to_string(),
        name,
        visibility,
        location,
        source_code,
        attributes,
        generic_parameters: vec![],
        parameters: None,
        return_type: None,
        fields: None,
        variants: None,
        impl_type: None,
        trait_name: None,
    })
}

fn extract_static_info(s: ast::Static) -> Option<ItemInfo> {
    let name = s.name()?.text().to_string();
    let visibility = extract_visibility(s.visibility());
    let syntax = s.syntax();
    let source_code = syntax.text().to_string();
    let location = text_range_to_location(syntax.text_range(), &source_code);
    let attributes = extract_attributes(&s);
    
    Some(ItemInfo {
        item_type: "static".to_string(),
        name,
        visibility,
        location,
        source_code,
        attributes,
        generic_parameters: vec![],
        parameters: None,
        return_type: None,
        fields: None,
        variants: None,
        impl_type: None,
        trait_name: None,
    })
}

fn extract_type_alias_info(t: ast::TypeAlias) -> Option<ItemInfo> {
    let name = t.name()?.text().to_string();
    let visibility = extract_visibility(t.visibility());
    let syntax = t.syntax();
    let source_code = syntax.text().to_string();
    let location = text_range_to_location(syntax.text_range(), &source_code);
    let generic_parameters = extract_generic_params(t.generic_param_list());
    let attributes = extract_attributes(&t);
    
    Some(ItemInfo {
        item_type: "type_alias".to_string(),
        name,
        visibility,
        location,
        source_code,
        attributes,
        generic_parameters,
        parameters: None,
        return_type: None,
        fields: None,
        variants: None,
        impl_type: None,
        trait_name: None,
    })
}

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

fn extract_parameters(func: &ast::Fn) -> Vec<ParameterInfo> {
    let mut params = Vec::new();
    
    if let Some(param_list) = func.param_list() {
        for param in param_list.params() {
            let name = param.syntax().text().to_string();
            
            // Check if it's a self parameter
            if name.contains("self") {
                params.push(ParameterInfo {
                    name: "self".to_string(),
                    param_type: "Self".to_string(),
                    is_self: true,
                    is_mutable: name.contains("mut"),
                });
            } else {
                // For regular parameters, try to extract name and type
                let param_text = param.syntax().text().to_string();
                let parts: Vec<&str> = param_text.split(':').collect();
                let param_name = parts.get(0).unwrap_or(&"").trim().to_string();
                let param_type = parts.get(1).unwrap_or(&"").trim().to_string();
                
                params.push(ParameterInfo {
                    name: param_name,
                    param_type,
                    is_self: false,
                    is_mutable: name.contains("mut"),
                });
            }
        }
    }
    
    params
}

fn extract_struct_fields(s: &ast::Struct) -> Vec<FieldInfo> {
    let mut fields = Vec::new();
    
    match s.field_list() {
        Some(ast::FieldList::RecordFieldList(record_fields)) => {
            for field in record_fields.fields() {
                if let Some(name) = field.name() {
                    let field_type = field.ty()
                        .map(|t| t.syntax().text().to_string())
                        .unwrap_or_default();
                    let visibility = extract_visibility(field.visibility());
                    
                    fields.push(FieldInfo {
                        name: name.text().to_string(),
                        field_type,
                        visibility,
                    });
                }
            }
        }
        Some(ast::FieldList::TupleFieldList(tuple_fields)) => {
            for (i, field) in tuple_fields.fields().enumerate() {
                let field_type = field.ty()
                    .map(|t| t.syntax().text().to_string())
                    .unwrap_or_default();
                let visibility = extract_visibility(field.visibility());
                
                fields.push(FieldInfo {
                    name: i.to_string(),
                    field_type,
                    visibility,
                });
            }
        }
        None => {}
    }
    
    fields
}

fn extract_enum_variants(e: &ast::Enum) -> Vec<VariantInfo> {
    let mut variants = Vec::new();
    
    if let Some(variant_list) = e.variant_list() {
        for variant in variant_list.variants() {
            if let Some(name) = variant.name() {
                let discriminant = variant.expr()
                    .map(|e| e.syntax().text().to_string());
                
                variants.push(VariantInfo {
                    name: name.text().to_string(),
                    discriminant,
                });
            }
        }
    }
    
    variants
}

fn extract_generic_params(generic_params: Option<ast::GenericParamList>) -> Vec<String> {
    let mut params = Vec::new();
    
    if let Some(param_list) = generic_params {
        for param in param_list.generic_params() {
            match param {
                ast::GenericParam::TypeParam(type_param) => {
                    if let Some(name) = type_param.name() {
                        params.push(name.text().to_string());
                    }
                }
                ast::GenericParam::LifetimeParam(lifetime_param) => {
                    if let Some(lifetime) = lifetime_param.lifetime() {
                        params.push(lifetime.text().to_string());
                    }
                }
                ast::GenericParam::ConstParam(const_param) => {
                    if let Some(name) = const_param.name() {
                        params.push(name.text().to_string());
                    }
                }
            }
        }
    }
    
    params
}

fn extract_attributes<N: AstNode>(node: &N) -> Vec<String> {
    let mut attributes = Vec::new();
    let syntax = node.syntax();
    
    // Look for attribute items before this node
    for child in syntax.children_with_tokens() {
        if let Some(node) = child.as_node() {
            if let Some(attr) = ast::Attr::cast(node.clone()) {
                attributes.push(attr.syntax().text().to_string());
            }
        }
    }
    
    attributes
}

fn text_range_to_location(range: TextRange, source: &str) -> SourceLocation {
    let start = range.start().into();
    let end = range.end().into();
    
    // Calculate line and column numbers
    let (start_line, start_column) = offset_to_line_col(source, start);
    let (end_line, end_column) = offset_to_line_col(source, end);
    
    SourceLocation {
        start_line,
        start_column,
        end_line,
        end_column,
        start_byte: start,
        end_byte: end,
    }
}

fn offset_to_line_col(source: &str, offset: u32) -> (u32, u32) {
    let mut line = 1;
    let mut col = 1;
    
    for (i, ch) in source.char_indices() {
        if i as u32 >= offset {
            break;
        }
        if ch == '\n' {
            line += 1;
            col = 1;
        } else {
            col += 1;
        }
    }
    
    (line, col)
}