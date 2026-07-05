use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::{Component, Path, PathBuf};

/// Per-folder manual ordering, keyed by folder path relative to the Notes
/// root ("" = root). Values are filesystem names in display order.
/// Lives as a dotfile inside the Notes root so the tree walk skips it.
const ORDER_FILE: &str = ".order.json";

type OrderMap = HashMap<String, Vec<String>>;

fn read_order(vault: &str) -> OrderMap {
    fs::read_to_string(notes_root(vault).join(ORDER_FILE))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_order(vault: &str, order: &OrderMap) -> Result<(), String> {
    let json = serde_json::to_string_pretty(order).map_err(|e| e.to_string())?;
    fs::write(notes_root(vault).join(ORDER_FILE), json).map_err(|e| e.to_string())
}

fn last_segment(path: &str) -> &str {
    path.rsplit('/').next().unwrap_or(path)
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NoteEntry {
    pub name: String, // display name (".md" stripped for files)
    pub path: String, // relative to the Notes root, '/'-separated
    pub is_dir: bool,
    pub children: Vec<NoteEntry>,
}

/// Notes live as plain markdown files in a visible folder at the vault root,
/// so the tree can be synced/edited by other tools too.
fn notes_root(vault: &str) -> PathBuf {
    Path::new(vault).join("Notes")
}

/// Resolve a relative path inside the notes root, rejecting traversal
fn resolve(vault: &str, rel: &str) -> Result<PathBuf, String> {
    let rel_path = Path::new(rel);
    let escapes = rel_path.components().any(|c| {
        matches!(
            c,
            Component::ParentDir | Component::RootDir | Component::Prefix(_)
        )
    });
    if escapes {
        return Err(format!("Invalid note path: {}", rel));
    }
    Ok(notes_root(vault).join(rel_path))
}

fn read_tree(dir: &Path, rel: &str, order: &OrderMap) -> Result<Vec<NoteEntry>, String> {
    let mut entries = Vec::new();
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())?.flatten() {
        let file_name = entry.file_name().to_string_lossy().to_string();
        if file_name.starts_with('.') {
            continue;
        }
        let child_rel = if rel.is_empty() {
            file_name.clone()
        } else {
            format!("{}/{}", rel, file_name)
        };
        let path = entry.path();
        if path.is_dir() {
            entries.push(NoteEntry {
                name: file_name,
                path: child_rel.clone(),
                is_dir: true,
                children: read_tree(&path, &child_rel, order)?,
            });
        } else if file_name.to_lowercase().ends_with(".md") {
            entries.push(NoteEntry {
                name: file_name[..file_name.len() - 3].to_string(),
                path: child_rel,
                is_dir: false,
                children: Vec::new(),
            });
        }
    }
    // Folders first, then alphabetical — matches the Obsidian sidebar
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    // Manual ordering wins where present; unlisted entries keep the
    // default sort and land after the ordered ones (stable sort)
    if let Some(names) = order.get(rel) {
        let pos: HashMap<&str, usize> = names
            .iter()
            .enumerate()
            .map(|(i, n)| (n.as_str(), i))
            .collect();
        entries.sort_by_key(|e| {
            pos.get(last_segment(&e.path)).copied().unwrap_or(usize::MAX)
        });
    }
    Ok(entries)
}

/// Find a non-colliding name like "Untitled", "Untitled 2", ...
fn unique_name(dir: &Path, base: &str, ext: Option<&str>) -> String {
    for i in 1u32.. {
        let candidate = if i == 1 {
            base.to_string()
        } else {
            format!("{} {}", base, i)
        };
        let file_name = match ext {
            Some(ext) => format!("{}.{}", candidate, ext),
            None => candidate.clone(),
        };
        if !dir.join(&file_name).exists() {
            return file_name;
        }
    }
    unreachable!()
}

fn join_rel(dir: &str, name: &str) -> String {
    if dir.is_empty() {
        name.to_string()
    } else {
        format!("{}/{}", dir, name)
    }
}

fn list_notes_impl(vault: String) -> Result<Vec<NoteEntry>, String> {
    let root = notes_root(&vault);
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    let order = read_order(&vault);
    read_tree(&root, "", &order)
}

fn set_note_order_impl(vault: String, dir: String, names: Vec<String>) -> Result<(), String> {
    let mut order = read_order(&vault);
    order.insert(dir, names);
    write_order(&vault, &order)
}

/// Move a file or folder into another folder; returns the new relative path
fn move_note_path_impl(vault: String, path: String, target_dir: String) -> Result<String, String> {
    if target_dir == path || target_dir.starts_with(&format!("{}/", path)) {
        return Err("Cannot move a folder into itself".into());
    }
    let abs = resolve(&vault, &path)?;
    let target = resolve(&vault, &target_dir)?;
    let name = last_segment(&path).to_string();
    let dest = target.join(&name);
    if dest.exists() {
        return Err(format!("\"{}\" already exists there", name));
    }
    fs::create_dir_all(&target).map_err(|e| e.to_string())?;
    fs::rename(&abs, &dest).map_err(|e| e.to_string())?;
    Ok(join_rel(&target_dir, &name))
}

fn read_note_impl(vault: String, path: String) -> Result<String, String> {
    fs::read_to_string(resolve(&vault, &path)?).map_err(|e| e.to_string())
}

fn write_note_impl(vault: String, path: String, content: String) -> Result<(), String> {
    let abs = resolve(&vault, &path)?;
    if let Some(parent) = abs.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(abs, content).map_err(|e| e.to_string())
}

fn create_note_impl(vault: String, dir: String) -> Result<String, String> {
    let parent = resolve(&vault, &dir)?;
    fs::create_dir_all(&parent).map_err(|e| e.to_string())?;
    let file_name = unique_name(&parent, "Untitled", Some("md"));
    fs::write(parent.join(&file_name), "").map_err(|e| e.to_string())?;
    Ok(join_rel(&dir, &file_name))
}

/// Create a note with a given display name and initial content, deduping
/// the filename if needed; returns the new relative path
fn create_note_with_impl(
    vault: String,
    dir: String,
    name: String,
    content: String,
) -> Result<String, String> {
    let base = name.replace(['/', '\\'], "-").trim().to_string();
    let base = if base.is_empty() { "Untitled".to_string() } else { base };
    let parent = resolve(&vault, &dir)?;
    fs::create_dir_all(&parent).map_err(|e| e.to_string())?;
    let file_name = unique_name(&parent, &base, Some("md"));
    fs::write(parent.join(&file_name), content).map_err(|e| e.to_string())?;
    Ok(join_rel(&dir, &file_name))
}

fn create_note_folder_impl(vault: String, dir: String) -> Result<String, String> {
    let parent = resolve(&vault, &dir)?;
    fs::create_dir_all(&parent).map_err(|e| e.to_string())?;
    let name = unique_name(&parent, "New folder", None);
    fs::create_dir(parent.join(&name)).map_err(|e| e.to_string())?;
    Ok(join_rel(&dir, &name))
}

/// Rename a file or folder in place; returns the new relative path
fn rename_note_path_impl(vault: String, path: String, new_name: String) -> Result<String, String> {
    let new_name = new_name.trim();
    if new_name.is_empty() || new_name.contains('/') || new_name.contains('\\') {
        return Err("Invalid name".into());
    }
    let abs = resolve(&vault, &path)?;
    let file_name = if abs.is_dir() || new_name.to_lowercase().ends_with(".md") {
        new_name.to_string()
    } else {
        format!("{}.md", new_name)
    };
    let new_abs = abs
        .parent()
        .ok_or("Invalid path")?
        .join(&file_name);
    if new_abs.exists() {
        return Err(format!("\"{}\" already exists", file_name));
    }
    fs::rename(&abs, &new_abs).map_err(|e| e.to_string())?;

    let parent_rel = match path.rfind('/') {
        Some(i) => &path[..i],
        None => "",
    };
    Ok(join_rel(parent_rel, &file_name))
}

fn delete_note_path_impl(vault: String, path: String) -> Result<(), String> {
    if path.is_empty() {
        return Err("Cannot delete the notes root".into());
    }
    let abs = resolve(&vault, &path)?;
    if abs.is_dir() {
        fs::remove_dir_all(abs).map_err(|e| e.to_string())
    } else {
        fs::remove_file(abs).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn list_notes(vault: String) -> Result<Vec<NoteEntry>, String> {
    super::run_blocking(move || list_notes_impl(vault)).await
}

#[tauri::command]
pub async fn read_note(vault: String, path: String) -> Result<String, String> {
    super::run_blocking(move || read_note_impl(vault, path)).await
}

#[tauri::command]
pub async fn write_note(vault: String, path: String, content: String) -> Result<(), String> {
    super::run_blocking(move || write_note_impl(vault, path, content)).await
}

#[tauri::command]
pub async fn create_note(vault: String, dir: String) -> Result<String, String> {
    super::run_blocking(move || create_note_impl(vault, dir)).await
}

#[tauri::command]
pub async fn create_note_with(
    vault: String,
    dir: String,
    name: String,
    content: String,
) -> Result<String, String> {
    super::run_blocking(move || create_note_with_impl(vault, dir, name, content)).await
}

#[tauri::command]
pub async fn create_note_folder(vault: String, dir: String) -> Result<String, String> {
    super::run_blocking(move || create_note_folder_impl(vault, dir)).await
}

#[tauri::command]
pub async fn rename_note_path(
    vault: String,
    path: String,
    new_name: String,
) -> Result<String, String> {
    super::run_blocking(move || rename_note_path_impl(vault, path, new_name)).await
}

#[tauri::command]
pub async fn delete_note_path(vault: String, path: String) -> Result<(), String> {
    super::run_blocking(move || delete_note_path_impl(vault, path)).await
}

#[tauri::command]
pub async fn set_note_order(vault: String, dir: String, names: Vec<String>) -> Result<(), String> {
    super::run_blocking(move || set_note_order_impl(vault, dir, names)).await
}

#[tauri::command]
pub async fn move_note_path(
    vault: String,
    path: String,
    target_dir: String,
) -> Result<String, String> {
    super::run_blocking(move || move_note_path_impl(vault, path, target_dir)).await
}
