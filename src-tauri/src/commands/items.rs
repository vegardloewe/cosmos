use std::fs;
use std::path::Path;

use crate::models::BoardItem;
use super::vault::{read_index, write_index};

fn read_asset_impl(vault: String, asset_path: String) -> Result<String, String> {
    let full_path = Path::new(&vault)
        .join(".moodboard")
        .join("assets")
        .join(&asset_path);
    let bytes = fs::read(&full_path)
        .map_err(|e| format!("Failed to read asset: {}", e))?;

    let ext = full_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase();
    let mime = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "bmp" => "image/bmp",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "mov" => "video/quicktime",
        "mkv" => "video/x-matroska",
        "avi" => "video/x-msvideo",
        _ => "application/octet-stream",
    };

    use std::io::Write;
    let mut buf = Vec::new();
    write!(buf, "data:{};base64,", mime).unwrap();
    let engine = base64_encode(&bytes);
    buf.extend_from_slice(engine.as_bytes());
    String::from_utf8(buf).map_err(|e| e.to_string())
}

fn read_asset_bytes_impl(vault: String, asset_path: String) -> Result<tauri::ipc::Response, String> {
    let full_path = Path::new(&vault)
        .join(".moodboard")
        .join("assets")
        .join(&asset_path);
    let bytes = fs::read(&full_path)
        .map_err(|e| format!("Failed to read asset: {}", e))?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
pub fn get_asset_path(vault: String, asset_path: String) -> Result<String, String> {
    let full_path = Path::new(&vault)
        .join(".moodboard")
        .join("assets")
        .join(&asset_path);
    full_path
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Invalid path".to_string())
}

fn base64_encode(data: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;
        result.push(CHARS[((triple >> 18) & 0x3F) as usize] as char);
        result.push(CHARS[((triple >> 12) & 0x3F) as usize] as char);
        if chunk.len() > 1 {
            result.push(CHARS[((triple >> 6) & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
        if chunk.len() > 2 {
            result.push(CHARS[(triple & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
    }
    result
}

fn now_millis() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis()
        .to_string()
}

fn import_image_impl(vault: String, source: String) -> Result<BoardItem, String> {
    let source_path = Path::new(&source);

    let ext = source_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase();

    let id = nanoid::nanoid!();
    let filename = format!("{}.{}", id, ext);
    let dest = Path::new(&vault)
        .join(".moodboard")
        .join("assets")
        .join(&filename);

    fs::copy(&source_path, &dest)
        .map_err(|e| format!("Failed to copy image: {}", e))?;

    // Read image dimensions
    let (width, height) = match image::image_dimensions(&dest) {
        Ok((w, h)) => (Some(w), Some(h)),
        Err(_) => (None, None),
    };

    let now = now_millis();
    let item = BoardItem {
        id,
        item_type: "image".to_string(),
        created_at: now.clone(),
        updated_at: now,
        tags: Vec::new(),
        collection_ids: Vec::new(),
        color: None,
        asset_path: Some(filename),
        width,
        height,
        url: None,
        link_title: None,
        link_description: None,
        link_preview_path: None,
        note_path: None,
        title: None,
        excerpt: None,
    };

    let mut index = read_index(&vault)?;
    index.items.push(item.clone());
    write_index(&vault, &index)?;

    Ok(item)
}

fn import_image_data_impl(vault: String, data: Vec<u8>, ext: String) -> Result<BoardItem, String> {
    let id = nanoid::nanoid!();
    let filename = format!("{}.{}", id, ext);
    let dest = Path::new(&vault)
        .join(".moodboard")
        .join("assets")
        .join(&filename);

    fs::write(&dest, &data)
        .map_err(|e| format!("Failed to write image data: {}", e))?;

    let (width, height) = match image::image_dimensions(&dest) {
        Ok((w, h)) => (Some(w), Some(h)),
        Err(_) => (None, None),
    };

    let now = now_millis();
    let item = BoardItem {
        id,
        item_type: "image".to_string(),
        created_at: now.clone(),
        updated_at: now,
        tags: Vec::new(),
        collection_ids: Vec::new(),
        color: None,
        asset_path: Some(filename),
        width,
        height,
        url: None,
        link_title: None,
        link_description: None,
        link_preview_path: None,
        note_path: None,
        title: None,
        excerpt: None,
    };

    let mut index = read_index(&vault)?;
    index.items.push(item.clone());
    write_index(&vault, &index)?;

    Ok(item)
}

fn import_video_impl(vault: String, source: String) -> Result<BoardItem, String> {
    let source_path = Path::new(&source);

    let ext = source_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("mp4")
        .to_lowercase();

    let id = nanoid::nanoid!();
    let filename = format!("{}.{}", id, ext);
    let dest = Path::new(&vault)
        .join(".moodboard")
        .join("assets")
        .join(&filename);

    fs::copy(&source_path, &dest)
        .map_err(|e| format!("Failed to copy video: {}", e))?;

    let now = now_millis();
    let item = BoardItem {
        id,
        item_type: "video".to_string(),
        created_at: now.clone(),
        updated_at: now,
        tags: Vec::new(),
        collection_ids: Vec::new(),
        color: None,
        asset_path: Some(filename),
        width: None,
        height: None,
        url: None,
        link_title: None,
        link_description: None,
        link_preview_path: None,
        note_path: None,
        title: None,
        excerpt: None,
    };

    let mut index = read_index(&vault)?;
    index.items.push(item.clone());
    write_index(&vault, &index)?;

    Ok(item)
}

fn import_video_data_impl(vault: String, data: Vec<u8>, ext: String) -> Result<BoardItem, String> {
    let id = nanoid::nanoid!();
    let filename = format!("{}.{}", id, ext);
    let dest = Path::new(&vault)
        .join(".moodboard")
        .join("assets")
        .join(&filename);

    fs::write(&dest, &data)
        .map_err(|e| format!("Failed to write video data: {}", e))?;

    let now = now_millis();
    let item = BoardItem {
        id,
        item_type: "video".to_string(),
        created_at: now.clone(),
        updated_at: now,
        tags: Vec::new(),
        collection_ids: Vec::new(),
        color: None,
        asset_path: Some(filename),
        width: None,
        height: None,
        url: None,
        link_title: None,
        link_description: None,
        link_preview_path: None,
        note_path: None,
        title: None,
        excerpt: None,
    };

    let mut index = read_index(&vault)?;
    index.items.push(item.clone());
    write_index(&vault, &index)?;

    Ok(item)
}

fn add_note_impl(vault: String, title: String, content: String) -> Result<BoardItem, String> {
    let id = nanoid::nanoid!();
    let filename = format!("{}.md", id);
    let dest = Path::new(&vault)
        .join(".moodboard")
        .join("notes")
        .join(&filename);

    fs::write(&dest, &content)
        .map_err(|e| format!("Failed to write note: {}", e))?;

    let excerpt = if content.len() > 100 {
        format!("{}...", &content[..100])
    } else {
        content.clone()
    };

    let now = now_millis();
    let item = BoardItem {
        id,
        item_type: "text".to_string(),
        created_at: now.clone(),
        updated_at: now,
        tags: Vec::new(),
        collection_ids: Vec::new(),
        color: None,
        asset_path: None,
        width: None,
        height: None,
        url: None,
        link_title: None,
        link_description: None,
        link_preview_path: None,
        note_path: Some(filename),
        title: Some(title),
        excerpt: Some(excerpt),
    };

    let mut index = read_index(&vault)?;
    index.items.push(item.clone());
    write_index(&vault, &index)?;

    Ok(item)
}

fn update_item_impl(vault: String, item: BoardItem) -> Result<(), String> {
    let mut index = read_index(&vault)?;

    let pos = index
        .items
        .iter()
        .position(|i| i.id == item.id)
        .ok_or_else(|| format!("Item not found: {}", item.id))?;

    let mut updated = item;
    updated.updated_at = now_millis();
    index.items[pos] = updated;

    write_index(&vault, &index)?;
    Ok(())
}

fn delete_item_impl(vault: String, id: String) -> Result<(), String> {
    let mut index = read_index(&vault)?;

    let pos = index
        .items
        .iter()
        .position(|i| i.id == id)
        .ok_or_else(|| format!("Item not found: {}", id))?;

    let item = &index.items[pos];
    let moodboard_dir = Path::new(&vault).join(".moodboard");

    // Delete associated file
    if let Some(ref asset) = item.asset_path {
        let asset_file = moodboard_dir.join("assets").join(asset);
        if asset_file.exists() {
            fs::remove_file(&asset_file)
                .map_err(|e| format!("Failed to delete asset: {}", e))?;
        }
    }
    if let Some(ref note) = item.note_path {
        let note_file = moodboard_dir.join("notes").join(note);
        if note_file.exists() {
            fs::remove_file(&note_file)
                .map_err(|e| format!("Failed to delete note: {}", e))?;
        }
    }
    if let Some(ref preview) = item.link_preview_path {
        let preview_file = moodboard_dir.join("assets").join(preview);
        if preview_file.exists() {
            fs::remove_file(&preview_file)
                .map_err(|e| format!("Failed to delete link preview: {}", e))?;
        }
    }

    index.items.remove(pos);
    write_index(&vault, &index)?;

    Ok(())
}

// Async wrappers: run the blocking bodies on the thread pool so the UI never stalls

#[tauri::command]
pub async fn read_asset(vault: String, asset_path: String) -> Result<String, String> {
    super::run_blocking(move || read_asset_impl(vault, asset_path)).await
}

#[tauri::command]
pub async fn read_asset_bytes(vault: String, asset_path: String) -> Result<tauri::ipc::Response, String> {
    super::run_blocking(move || read_asset_bytes_impl(vault, asset_path)).await
}

#[tauri::command]
pub async fn import_image(vault: String, source: String) -> Result<BoardItem, String> {
    super::run_blocking(move || import_image_impl(vault, source)).await
}

#[tauri::command]
pub async fn import_image_data(vault: String, data: Vec<u8>, ext: String) -> Result<BoardItem, String> {
    super::run_blocking(move || import_image_data_impl(vault, data, ext)).await
}

#[tauri::command]
pub async fn import_video(vault: String, source: String) -> Result<BoardItem, String> {
    super::run_blocking(move || import_video_impl(vault, source)).await
}

#[tauri::command]
pub async fn import_video_data(vault: String, data: Vec<u8>, ext: String) -> Result<BoardItem, String> {
    super::run_blocking(move || import_video_data_impl(vault, data, ext)).await
}

#[tauri::command]
pub async fn add_note(vault: String, title: String, content: String) -> Result<BoardItem, String> {
    super::run_blocking(move || add_note_impl(vault, title, content)).await
}

#[tauri::command]
pub async fn update_item(vault: String, item: BoardItem) -> Result<(), String> {
    super::run_blocking(move || update_item_impl(vault, item)).await
}

#[tauri::command]
pub async fn delete_item(vault: String, id: String) -> Result<(), String> {
    super::run_blocking(move || delete_item_impl(vault, id)).await
}
