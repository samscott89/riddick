use std::env;
use std::fs;
use std::path::Path;

mod parser;

use parser::parse_rust_code;

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() != 2 {
        eprintln!("Usage: {} <rust_file_path>", args[0]);
        std::process::exit(1);
    }

    let file_path = &args[1];

    if !Path::new(file_path).exists() {
        eprintln!("Error: File '{file_path}' does not exist");
        std::process::exit(1);
    }

    let code = match fs::read_to_string(file_path) {
        Ok(content) => content,
        Err(err) => {
            eprintln!("Error reading file '{file_path}': {err}");
            std::process::exit(1);
        }
    };

    match parse_rust_code(&code) {
        Ok(response) => {
            // Pretty print the JSON output
            match serde_json::to_string_pretty(&response) {
                Ok(json) => println!("{json}"),
                Err(err) => {
                    eprintln!("Error serializing response: {err}");
                    std::process::exit(1);
                }
            }
        }
        Err(err) => {
            eprintln!("Error parsing Rust code: {err}");
            std::process::exit(1);
        }
    }
}
