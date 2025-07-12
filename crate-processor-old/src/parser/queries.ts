// Tree-sitter query patterns for extracting Rust constructs

export const RUST_QUERIES = {
  // Function definitions
  FUNCTIONS: `
    (function_item
      (visibility_modifier)? @visibility
      (attribute_item)* @attributes
      name: (identifier) @name
      (generic_parameters)? @generics
      parameters: (parameters) @params
      (where_clause)? @where
      return_type: (type_annotation (type_identifier) @return_type)?
      body: (block) @body
    ) @function
  `,

  // Struct definitions
  STRUCTS: `
    (struct_item
      (visibility_modifier)? @visibility
      (attribute_item)* @attributes
      name: (type_identifier) @name
      (generic_parameters)? @generics
      (where_clause)? @where
      body: (field_declaration_list
        (field_declaration
          (visibility_modifier)? @field_visibility
          name: (field_identifier) @field_name
          type: (_) @field_type
        )*
      ) @fields
    ) @struct
  `,

  // Enum definitions
  ENUMS: `
    (enum_item
      (visibility_modifier)? @visibility
      (attribute_item)* @attributes
      name: (type_identifier) @name
      (generic_parameters)? @generics
      (where_clause)? @where
      body: (enum_variant_list
        (enum_variant
          (attribute_item)* @variant_attributes
          name: (identifier) @variant_name
          (field_declaration_list
            (field_declaration
              (visibility_modifier)? @variant_field_visibility
              name: (field_identifier) @variant_field_name
              type: (_) @variant_field_type
            )*
          )? @variant_fields
          (tuple_struct_pattern
            ((_) @variant_tuple_type)*
          )? @variant_tuple
          (ordered_field_declaration_list
            (ordered_field_declaration
              (visibility_modifier)? @variant_ordered_visibility
              type: (_) @variant_ordered_type
            )*
          )? @variant_ordered
          (discriminant value: (_) @variant_discriminant)?
        )*
      ) @variants
    ) @enum
  `,

  // Impl blocks
  IMPLS: `
    (impl_item
      (attribute_item)* @attributes
      (generic_parameters)? @generics
      trait: (type_identifier)? @trait_name
      "for"? @for_keyword
      type: (_) @impl_type
      (where_clause)? @where
      body: (declaration_list
        (function_item)* @methods
        (associated_type)* @associated_types
        (const_item)* @constants
      ) @body
    ) @impl
  `,

  // Module declarations
  MODULES: `
    (mod_item
      (visibility_modifier)? @visibility
      (attribute_item)* @attributes
      name: (identifier) @name
      body: (declaration_list
        (_)* @items
      )? @body
    ) @module
  `,

  // Trait definitions
  TRAITS: `
    (trait_item
      (visibility_modifier)? @visibility
      (attribute_item)* @attributes
      name: (type_identifier) @name
      (generic_parameters)? @generics
      (trait_bounds)? @bounds
      (where_clause)? @where
      body: (declaration_list
        (function_signature_item)* @function_signatures
        (associated_type)* @associated_types
        (const_item)* @constants
      ) @body
    ) @trait
  `,

  // Type aliases
  TYPE_ALIASES: `
    (type_item
      (visibility_modifier)? @visibility
      (attribute_item)* @attributes
      name: (type_identifier) @name
      (generic_parameters)? @generics
      (where_clause)? @where
      type: (_) @type_definition
    ) @type_alias
  `,

  // Constants
  CONSTANTS: `
    (const_item
      (visibility_modifier)? @visibility
      (attribute_item)* @attributes
      name: (identifier) @name
      type: (_) @const_type
      value: (_) @value
    ) @const
  `,

  // Static variables
  STATICS: `
    (static_item
      (visibility_modifier)? @visibility
      (attribute_item)* @attributes
      (mutable_specifier)? @mutable
      name: (identifier) @name
      type: (_) @static_type
      value: (_) @value
    ) @static
  `,

  // Use statements
  USE_STATEMENTS: `
    (use_declaration
      (visibility_modifier)? @visibility
      (attribute_item)* @attributes
      argument: (_) @use_tree
    ) @use
  `,

  // Macro definitions
  MACROS: `
    (macro_definition
      (visibility_modifier)? @visibility
      (attribute_item)* @attributes
      name: (identifier) @name
      (macro_rule)* @rules
    ) @macro
  `,

  // Generic parameters
  GENERIC_PARAMS: `
    (generic_parameters
      (type_parameter
        (attribute_item)* @param_attributes
        name: (type_identifier) @param_name
        (trait_bounds)? @param_bounds
      )* @type_params
      (lifetime_parameter
        (attribute_item)* @lifetime_attributes
        name: (lifetime) @lifetime_name
        (trait_bounds)? @lifetime_bounds
      )* @lifetime_params
      (const_parameter
        (attribute_item)* @const_attributes
        name: (identifier) @const_name
        type: (_) @const_type
      )* @const_params
    ) @generics
  `,

  // Function parameters
  FUNCTION_PARAMS: `
    (parameters
      (parameter
        (attribute_item)* @param_attributes
        pattern: (identifier) @param_name
        type: (_) @param_type
      )* @params
      (self_parameter
        (attribute_item)* @self_attributes
        "&"? @self_ref
        (mutable_specifier)? @self_mut
        (lifetime)? @self_lifetime
      )? @self_param
    ) @parameters
  `,

  // Attributes
  ATTRIBUTES: `
    (attribute_item
      (attribute
        (identifier) @attr_name
        (attribute_arguments)? @attr_args
      ) @attr
    ) @attribute
  `,

  // Visibility modifiers
  VISIBILITY: `
    (visibility_modifier
      "pub" @pub
      (
        "(" @open_paren
        (
          "crate" @crate_vis |
          "super" @super_vis |
          "self" @self_vis |
          ("in" @in_vis (path) @vis_path)
        ) @vis_modifier
        ")" @close_paren
      )? @vis_restriction
    ) @visibility
  `,

  // All top-level items
  TOP_LEVEL_ITEMS: `
    (source_file
      (function_item)* @functions
      (struct_item)* @structs
      (enum_item)* @enums
      (impl_item)* @impls
      (mod_item)* @modules
      (trait_item)* @traits
      (type_item)* @type_aliases
      (const_item)* @constants
      (static_item)* @statics
      (use_declaration)* @use_statements
      (macro_definition)* @macros
    ) @source_file
  `,
}

export const QUERY_NAMES = Object.keys(RUST_QUERIES) as Array<
  keyof typeof RUST_QUERIES
>

export type QueryName = keyof typeof RUST_QUERIES
