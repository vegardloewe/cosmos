pub mod vault;
pub mod items;
pub mod links;
pub mod ai;
pub mod books;
pub mod capture;
pub mod goals;
pub mod tasks;
pub mod notes;

/// Run blocking work (fs, network) on the thread pool. Sync commands execute
/// on the main thread in Tauri v2, so anything slow must go through this to
/// avoid freezing the UI.
pub async fn run_blocking<T: Send + 'static>(
    f: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| format!("Background task failed: {}", e))?
}
