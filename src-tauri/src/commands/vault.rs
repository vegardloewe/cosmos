use std::fs;
use std::path::Path;

use tauri::Manager;

use crate::models::{Collection, VaultIndex};

/// Read the vault index from .moodboard/index.json
pub fn read_index(vault_path: &str) -> Result<VaultIndex, String> {
    let index_path = Path::new(vault_path).join(".moodboard").join("index.json");
    let data = fs::read_to_string(&index_path)
        .map_err(|e| format!("Failed to read index: {}", e))?;
    serde_json::from_str(&data)
        .map_err(|e| format!("Failed to parse index: {}", e))
}

/// Write the vault index atomically: write to .tmp then rename
pub fn write_index(vault_path: &str, index: &VaultIndex) -> Result<(), String> {
    let moodboard_dir = Path::new(vault_path).join(".moodboard");
    let index_path = moodboard_dir.join("index.json");
    let tmp_path = moodboard_dir.join("index.json.tmp");

    let data = serde_json::to_string_pretty(index)
        .map_err(|e| format!("Failed to serialize index: {}", e))?;

    fs::write(&tmp_path, &data)
        .map_err(|e| format!("Failed to write temp index: {}", e))?;

    fs::rename(&tmp_path, &index_path)
        .map_err(|e| format!("Failed to rename temp index: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn create_vault(path: String) -> Result<(), String> {
    let base = Path::new(&path);
    let moodboard_dir = base.join(".moodboard");
    let assets_dir = moodboard_dir.join("assets");
    let notes_dir = moodboard_dir.join("notes");

    fs::create_dir_all(&assets_dir)
        .map_err(|e| format!("Failed to create assets dir: {}", e))?;
    fs::create_dir_all(&notes_dir)
        .map_err(|e| format!("Failed to create notes dir: {}", e))?;

    let index = VaultIndex::new();
    write_index(&path, &index)?;

    Ok(())
}

#[tauri::command]
pub fn open_vault(path: String) -> Result<VaultIndex, String> {
    let index_path = Path::new(&path).join(".moodboard").join("index.json");
    if !index_path.exists() {
        return Err("No vault found at this path (missing .moodboard/index.json)".to_string());
    }
    read_index(&path)
}

#[tauri::command]
pub fn get_vault_path(app_handle: tauri::AppHandle) -> Result<Option<String>, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not resolve app data directory: {}", e))?;

    let vault_path_file = app_data_dir.join("vault_path.txt");

    if !vault_path_file.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&vault_path_file)
        .map_err(|e| format!("Failed to read vault path file: {}", e))?;

    let trimmed = content.trim().to_string();
    if trimmed.is_empty() {
        Ok(None)
    } else {
        Ok(Some(trimmed))
    }
}

#[tauri::command]
pub fn set_vault_path(app_handle: tauri::AppHandle, path: String) -> Result<(), String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not resolve app data directory: {}", e))?;

    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data dir: {}", e))?;

    let vault_path_file = app_data_dir.join("vault_path.txt");

    fs::write(&vault_path_file, &path)
        .map_err(|e| format!("Failed to write vault path file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn create_collection(vault: String, name: String, color: String) -> Result<Collection, String> {
    let mut index = read_index(&vault)?;

    let collection = Collection {
        id: nanoid::nanoid!(),
        name,
        color,
    };

    index.collections.push(collection.clone());
    write_index(&vault, &index)?;

    Ok(collection)
}

#[tauri::command]
pub fn delete_collection(vault: String, id: String) -> Result<(), String> {
    let mut index = read_index(&vault)?;

    index.collections.retain(|c| c.id != id);
    // Remove collection from all items
    for item in &mut index.items {
        item.collection_ids.retain(|cid| *cid != id);
    }

    write_index(&vault, &index)?;
    Ok(())
}

#[tauri::command]
pub fn rename_collection(vault: String, id: String, name: String) -> Result<(), String> {
    let mut index = read_index(&vault)?;

    let collection = index
        .collections
        .iter_mut()
        .find(|c| c.id == id)
        .ok_or_else(|| format!("Collection not found: {}", id))?;

    collection.name = name;
    write_index(&vault, &index)?;
    Ok(())
}
