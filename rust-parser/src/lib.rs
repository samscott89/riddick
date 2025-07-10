use axum::{
    routing::{get, post},
    Router,
};
use tower_service::Service;
use worker::*;

fn router() -> Router {
    Router::new().route("/", post(root))
}

#[event(fetch)]
async fn fetch(
    req: HttpRequest,
    _env: Env,
    _ctx: Context,
) -> Result<axum::http::Response<axum::body::Body>> {
    console_error_panic_hook::set_once();
    Ok(router().call(req).await?)
}

#[derive(serde::Serialize)]
pub struct ParsingResult {
    node: String,
    errors: Vec<String>,
}

pub async fn root(query: String) -> String {
    let parsed = ra_ap_syntax::SourceFile::parse(&query, ra_ap_syntax::Edition::Edition2024);

    format!(
        "PARSED:\n{:#?}\nErrors: {}\n\n",
        parsed.syntax_node().clone(),
        parsed
            .errors()
            .iter()
            .map(|e| e.to_string())
            .collect::<Vec<_>>()
            .join("\n\n")
    )
}
