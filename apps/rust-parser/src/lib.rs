use wasm_bindgen::prelude::*;
use worker::*;

use tracing_subscriber::fmt::format::Pretty;
use tracing_subscriber::fmt::time::UtcTime;
use tracing_subscriber::prelude::*;
use tracing_web::{performance_layer, MakeConsoleWriter};

mod parser;

use parser::ParseRequest;

// Multiple calls to `init` will cause a panic as a tracing subscriber is already set.
// So we use the `start` event to initialize our tracing subscriber when the worker starts.
#[event(start)]
fn start() {
    let fmt_layer = tracing_subscriber::fmt::layer()
        .json()
        .with_ansi(false) // Only partially supported across JavaScript runtimes
        .with_timer(UtcTime::rfc_3339()) // std::time is not available in browsers
        .with_writer(MakeConsoleWriter); // write events to the console
    let perf_layer = performance_layer().with_details_from_fields(Pretty::default());
    tracing_subscriber::registry()
        .with(fmt_layer)
        .with(perf_layer)
        .init();
}

// RPC handler for parsing Rust code
#[wasm_bindgen]
pub fn parse_rust_code(request: JsValue) -> Result<JsValue> {
    let request: ParseRequest = serde_wasm_bindgen::from_value(request)?;
    tracing::info!("Received parse request: {:?}", request);
    // Call the parser function
    let response = parser::parse_rust_code(&request.code)?;

    Ok(serde_wasm_bindgen::to_value(&response)?)
}
