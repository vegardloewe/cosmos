use std::process::Command;

use tauri::{AppHandle, Emitter, Manager};

use super::links::{create_link_item, enrich_link_item};
use super::vault::{get_vault_path, read_index};

fn osascript(script: &str) -> Option<String> {
    let output = Command::new("osascript").arg("-e").arg(script).output().ok()?;
    if !output.status.success() {
        return None;
    }
    let result = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if result.is_empty() {
        None
    } else {
        Some(result)
    }
}

/// Get the URL of the active tab in the frontmost browser (macOS only)
fn frontmost_browser_url() -> Option<String> {
    let front = osascript(
        r#"tell application "System Events" to get name of first process whose frontmost is true"#,
    )?;

    let script = match front.as_str() {
        "Safari" => r#"tell application "Safari" to get URL of front document"#.to_string(),
        "Google Chrome" | "Arc" | "Brave Browser" | "Microsoft Edge" | "Chromium" | "Vivaldi"
        | "Opera" | "Dia" => format!(
            r#"tell application "{}" to get URL of active tab of front window"#,
            front
        ),
        _ => return None,
    };

    osascript(&script).filter(|u| u.starts_with("http"))
}

/// Fallback for unsupported browsers: use the clipboard if it holds a URL
fn clipboard_url() -> Option<String> {
    let output = Command::new("pbpaste").output().ok()?;
    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if text.starts_with("http://") || text.starts_with("https://") {
        Some(text)
    } else {
        None
    }
}

/// Triggered by the global hotkey: capture the page the user is looking at
/// and add it to the moodboard as a link item.
pub fn capture_current_page(app: AppHandle) {
    let Some(url) = frontmost_browser_url().or_else(clipboard_url) else {
        return;
    };

    let vault = match get_vault_path(app.clone()) {
        Ok(Some(v)) => v,
        _ => return,
    };

    // Skip if this URL is already on the board
    if let Ok(index) = read_index(&vault) {
        if index.items.iter().any(|i| i.url.as_deref() == Some(url.as_str())) {
            return;
        }
    }

    // Add a bare item immediately — metadata is fetched in the background so
    // the sweep + app focus never wait on the network
    let item = match create_link_item(&vault, &url) {
        Ok(item) => item,
        Err(e) => {
            eprintln!("Capture failed for {}: {}", url, e);
            return;
        }
    };
    let _ = app.emit("link-captured", &item);

    {
        let app = app.clone();
        let vault = vault.clone();
        let id = item.id.clone();
        let url = url.clone();
        std::thread::spawn(move || match enrich_link_item(&vault, &id, &url) {
            Ok(updated) => {
                let _ = app.emit("link-enriched", &updated);
            }
            Err(e) => eprintln!("Enrichment failed for {}: {}", url, e),
        });
    }

    focus_main_window(&app);
}

/// Bring the Cosmos window to the front after a capture
fn focus_main_window(app: &AppHandle) {
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        if let Some(main) = handle.get_webview_window("main") {
            let _ = main.show();
            let _ = main.unminimize();
            let _ = main.set_focus();
        }
    });
}
