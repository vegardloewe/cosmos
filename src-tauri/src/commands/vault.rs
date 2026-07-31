use std::fs;
use std::path::{Path, PathBuf};

use tauri::Manager;
#[cfg(target_os = "ios")]
use tauri_plugin_cosmos_icloud_vault::CosmosIcloudVaultExt;

use crate::models::{Collection, TaskStore, VaultIndex};

const VAULT_DIRECTORY: &str = ".moodboard";
const INDEX_FILE: &str = "index.json";
const TASKS_FILE: &str = "tasks.json";

fn vault_directory(vault_path: &str) -> PathBuf {
    Path::new(vault_path).join(VAULT_DIRECTORY)
}

fn write_json_atomically<T: serde::Serialize>(
    path: &Path,
    value: &T,
    label: &str,
) -> Result<(), String> {
    let data = serde_json::to_string_pretty(value)
        .map_err(|e| format!("Failed to serialize {}: {}", label, e))?;

    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| format!("Invalid {} path", label))?;
    // Use a unique sibling file so a task update can never overwrite an
    // in-flight write of another vault document.
    let tmp_path = path.with_file_name(format!("{}.{}.tmp", file_name, nanoid::nanoid!()));

    fs::write(&tmp_path, &data)
        .map_err(|e| format!("Failed to write temporary {}: {}", label, e))?;

    fs::rename(&tmp_path, path).map_err(|e| format!("Failed to replace {}: {}", label, e))?;

    Ok(())
}

/// Read the vault index from .moodboard/index.json
pub fn read_index(vault_path: &str) -> Result<VaultIndex, String> {
    let index_path = vault_directory(vault_path).join(INDEX_FILE);
    let data =
        fs::read_to_string(&index_path).map_err(|e| format!("Failed to read index: {}", e))?;
    serde_json::from_str(&data).map_err(|e| format!("Failed to parse index: {}", e))
}

/// Write the vault index atomically: write to .tmp then rename
pub fn write_index(vault_path: &str, index: &VaultIndex) -> Result<(), String> {
    write_json_atomically(
        &vault_directory(vault_path).join(INDEX_FILE),
        index,
        "index",
    )
}

/// Read task data from its own iCloud-friendly document. Older vaults are
/// migrated on first access, while their legacy task fields stay untouched so
/// an interrupted migration never loses data.
#[cfg_attr(target_os = "ios", allow(dead_code))]
pub fn read_task_store(vault_path: &str) -> Result<TaskStore, String> {
    let task_path = vault_directory(vault_path).join(TASKS_FILE);
    if task_path.exists() {
        let data = fs::read_to_string(&task_path)
            .map_err(|e| format!("Failed to read task store: {}", e))?;
        return serde_json::from_str(&data)
            .map_err(|e| format!("Failed to parse task store: {}", e));
    }

    let legacy_index = read_index(vault_path)?;
    let store = TaskStore {
        version: 1,
        task_projects: legacy_index.task_projects,
        tasks: legacy_index.tasks,
    };
    write_task_store(vault_path, &store)?;
    Ok(store)
}

pub fn write_task_store(vault_path: &str, store: &TaskStore) -> Result<(), String> {
    write_json_atomically(
        &vault_directory(vault_path).join(TASKS_FILE),
        store,
        "task store",
    )
}

/// iOS task mutations go through the native plugin so `NSFileCoordinator`
/// serializes access with iCloud Drive. Other platforms continue to use the
/// same direct, atomic local-file implementation.
pub fn read_task_store_for_app(
    app_handle: &tauri::AppHandle,
    vault_path: &str,
) -> Result<TaskStore, String> {
    #[cfg(target_os = "ios")]
    {
        let task_path = vault_directory(vault_path).join(TASKS_FILE);
        if task_path.exists() {
            let data = app_handle
                .cosmos_icloud_vault()
                .read_task_store(vault_path.to_string())
                .map_err(|e| e.to_string())?;
            return serde_json::from_str(&data)
                .map_err(|e| format!("Failed to parse task store: {}", e));
        }

        let legacy_index = read_index(vault_path)?;
        let store = TaskStore {
            version: 1,
            task_projects: legacy_index.task_projects,
            tasks: legacy_index.tasks,
        };
        write_task_store_for_app(app_handle, vault_path, &store)?;
        Ok(store)
    }

    #[cfg(not(target_os = "ios"))]
    {
        let _ = app_handle;
        read_task_store(vault_path)
    }
}

pub fn write_task_store_for_app(
    app_handle: &tauri::AppHandle,
    vault_path: &str,
    store: &TaskStore,
) -> Result<(), String> {
    #[cfg(target_os = "ios")]
    {
        let data = serde_json::to_string_pretty(store)
            .map_err(|e| format!("Failed to serialize task store: {}", e))?;
        app_handle
            .cosmos_icloud_vault()
            .write_task_store(vault_path.to_string(), data)
            .map_err(|e| e.to_string())
    }

    #[cfg(not(target_os = "ios"))]
    {
        let _ = app_handle;
        write_task_store(vault_path, store)
    }
}

#[tauri::command]
pub async fn create_vault(path: String) -> Result<(), String> {
    super::run_blocking(move || create_vault_impl(path)).await
}

fn create_vault_impl(path: String) -> Result<(), String> {
    let base = Path::new(&path);
    let moodboard_dir = base.join(VAULT_DIRECTORY);
    let assets_dir = moodboard_dir.join("assets");
    let notes_dir = moodboard_dir.join("notes");

    fs::create_dir_all(&assets_dir).map_err(|e| format!("Failed to create assets dir: {}", e))?;
    fs::create_dir_all(&notes_dir).map_err(|e| format!("Failed to create notes dir: {}", e))?;

    let index = VaultIndex::new();
    write_index(&path, &index)?;
    write_task_store(&path, &TaskStore::new())?;

    Ok(())
}

#[tauri::command]
pub async fn open_vault(app_handle: tauri::AppHandle, path: String) -> Result<VaultIndex, String> {
    super::run_blocking(move || {
        let index_path = vault_directory(&path).join(INDEX_FILE);
        if !index_path.exists() {
            return Err("No vault found at this path (missing .moodboard/index.json)".to_string());
        }
        let mut index = read_index(&path)?;
        let task_store = read_task_store_for_app(&app_handle, &path)?;
        index.task_projects = task_store.task_projects;
        index.tasks = task_store.tasks;
        Ok(index)
    })
    .await
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

/// On iOS, the native plugin presents Files' folder picker and retains the
/// scoped iCloud Drive permission. The returned path feeds the same local
/// vault commands used on macOS.
#[tauri::command]
pub async fn choose_icloud_vault(app_handle: tauri::AppHandle) -> Result<String, String> {
    #[cfg(target_os = "ios")]
    {
        app_handle
            .cosmos_icloud_vault()
            .choose_vault()
            .map(|vault| vault.path)
            .map_err(|e| e.to_string())
    }

    #[cfg(not(target_os = "ios"))]
    {
        let _ = app_handle;
        Err("iCloud Drive folder selection is only available on iOS".to_string())
    }
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{Task, TaskProject};

    fn test_vault_path() -> std::path::PathBuf {
        std::env::temp_dir().join(format!("cosmos-vault-test-{}", nanoid::nanoid!()))
    }

    #[test]
    fn migrates_legacy_tasks_to_the_dedicated_store() {
        let vault = test_vault_path();
        let vault_string = vault.to_string_lossy().to_string();
        fs::create_dir_all(vault.join(VAULT_DIRECTORY)).unwrap();

        let mut legacy = VaultIndex::new();
        legacy.task_projects.push(TaskProject {
            id: "project-1".into(),
            name: "Home".into(),
            color: "blue".into(),
        });
        legacy.tasks.push(Task {
            id: "task-1".into(),
            project_id: "project-1".into(),
            title: "Buy milk".into(),
            description: None,
            status: "todo".into(),
            priority: None,
            effort: None,
            deadline: None,
            completed_at: None,
            created_at: "1".into(),
            updated_at: "1".into(),
        });
        write_index(&vault_string, &legacy).unwrap();

        let migrated = read_task_store(&vault_string).unwrap();
        assert_eq!(migrated.task_projects.len(), 1);
        assert_eq!(migrated.tasks.len(), 1);
        assert!(vault.join(VAULT_DIRECTORY).join(TASKS_FILE).exists());

        fs::remove_dir_all(vault).unwrap();
    }
}
