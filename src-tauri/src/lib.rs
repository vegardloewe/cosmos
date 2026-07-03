mod models;
mod commands;

use commands::{vault, items, links, ai, books, capture};
use tauri_plugin_global_shortcut::ShortcutState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    dotenvy::dotenv().ok();
    tauri::Builder::default()
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcuts(["cmd+shift+s"])
                .expect("invalid capture shortcut")
                .with_handler(|app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        let app = app.clone();
                        // Blocking work (AppleScript + HTTP fetch) off the main thread
                        std::thread::spawn(move || capture::capture_current_page(app));
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            vault::create_vault,
            vault::open_vault,
            vault::get_vault_path,
            vault::set_vault_path,
            items::read_asset,
            items::read_asset_bytes,
            items::get_asset_path,
            items::import_image,
            items::import_image_data,
            items::import_video,
            items::import_video_data,
            items::add_note,
            items::update_item,
            items::delete_item,
            links::import_link,
            vault::create_collection,
            vault::delete_collection,
            vault::rename_collection,
            ai::auto_tag_item,
            books::search_books,
            books::add_book,
            books::update_book,
            books::set_book_cover,
            books::delete_book,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
