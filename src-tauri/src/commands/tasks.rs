use super::vault::{read_task_store_for_app, write_task_store_for_app};
use crate::models::{Task, TaskProject, TaskStore};

fn now_millis() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis()
        .to_string()
}

fn add_task_project_impl(
    app_handle: tauri::AppHandle,
    vault: String,
    name: String,
    color: String,
) -> Result<TaskProject, String> {
    let project = TaskProject {
        id: nanoid::nanoid!(),
        name,
        color,
    };

    let mut store = read_task_store_for_app(&app_handle, &vault)?;
    store.task_projects.push(project.clone());
    write_task_store_for_app(&app_handle, &vault, &store)?;

    Ok(project)
}

fn delete_task_project_impl(
    app_handle: tauri::AppHandle,
    vault: String,
    id: String,
) -> Result<(), String> {
    let mut store = read_task_store_for_app(&app_handle, &vault)?;
    store.task_projects.retain(|p| p.id != id);
    store.tasks.retain(|t| t.project_id != id);
    write_task_store_for_app(&app_handle, &vault, &store)?;
    Ok(())
}

fn add_task_impl(
    app_handle: tauri::AppHandle,
    vault: String,
    project_id: String,
    title: String,
    description: Option<String>,
    status: String,
    priority: Option<String>,
    effort: Option<String>,
    deadline: Option<String>,
) -> Result<Task, String> {
    let now = now_millis();
    let task = Task {
        id: nanoid::nanoid!(),
        project_id,
        title,
        description,
        completed_at: if status == "done" {
            Some(now.clone())
        } else {
            None
        },
        status,
        priority,
        effort,
        deadline,
        created_at: now.clone(),
        updated_at: now,
    };

    let mut store = read_task_store_for_app(&app_handle, &vault)?;
    store.tasks.push(task.clone());
    write_task_store_for_app(&app_handle, &vault, &store)?;

    Ok(task)
}

fn update_task_impl(app_handle: tauri::AppHandle, vault: String, task: Task) -> Result<(), String> {
    let mut store = read_task_store_for_app(&app_handle, &vault)?;

    let existing = store
        .tasks
        .iter_mut()
        .find(|t| t.id == task.id)
        .ok_or_else(|| format!("Task not found: {}", task.id))?;

    *existing = Task {
        updated_at: now_millis(),
        ..task
    };

    write_task_store_for_app(&app_handle, &vault, &store)?;
    Ok(())
}

fn delete_task_impl(app_handle: tauri::AppHandle, vault: String, id: String) -> Result<(), String> {
    let mut store = read_task_store_for_app(&app_handle, &vault)?;
    store.tasks.retain(|t| t.id != id);
    write_task_store_for_app(&app_handle, &vault, &store)?;
    Ok(())
}

/// Persist a manual ordering: sort the tasks array by the given id list
fn reorder_tasks_impl(
    app_handle: tauri::AppHandle,
    vault: String,
    ids: Vec<String>,
) -> Result<(), String> {
    use std::collections::HashMap;

    let positions: HashMap<&str, usize> = ids
        .iter()
        .enumerate()
        .map(|(i, id)| (id.as_str(), i))
        .collect();

    let mut store = read_task_store_for_app(&app_handle, &vault)?;
    store
        .tasks
        .sort_by_key(|t| positions.get(t.id.as_str()).copied().unwrap_or(usize::MAX));
    write_task_store_for_app(&app_handle, &vault, &store)?;
    Ok(())
}

/// Read only the independently synced task store.  Keeping this separate from
/// `open_vault` lets the UI refresh iCloud task changes without reloading the
/// user's moodboard, books, goals, or notes.
#[tauri::command]
pub async fn read_task_store(
    app_handle: tauri::AppHandle,
    vault: String,
) -> Result<TaskStore, String> {
    super::run_blocking(move || read_task_store_for_app(&app_handle, &vault)).await
}

#[tauri::command]
pub async fn add_task_project(
    app_handle: tauri::AppHandle,
    vault: String,
    name: String,
    color: String,
) -> Result<TaskProject, String> {
    super::run_blocking(move || add_task_project_impl(app_handle, vault, name, color)).await
}

#[tauri::command]
pub async fn delete_task_project(
    app_handle: tauri::AppHandle,
    vault: String,
    id: String,
) -> Result<(), String> {
    super::run_blocking(move || delete_task_project_impl(app_handle, vault, id)).await
}

#[tauri::command]
pub async fn add_task(
    app_handle: tauri::AppHandle,
    vault: String,
    project_id: String,
    title: String,
    description: Option<String>,
    status: String,
    priority: Option<String>,
    effort: Option<String>,
    deadline: Option<String>,
) -> Result<Task, String> {
    super::run_blocking(move || {
        add_task_impl(
            app_handle,
            vault,
            project_id,
            title,
            description,
            status,
            priority,
            effort,
            deadline,
        )
    })
    .await
}

#[tauri::command]
pub async fn update_task(
    app_handle: tauri::AppHandle,
    vault: String,
    task: Task,
) -> Result<(), String> {
    super::run_blocking(move || update_task_impl(app_handle, vault, task)).await
}

#[tauri::command]
pub async fn delete_task(
    app_handle: tauri::AppHandle,
    vault: String,
    id: String,
) -> Result<(), String> {
    super::run_blocking(move || delete_task_impl(app_handle, vault, id)).await
}

#[tauri::command]
pub async fn reorder_tasks(
    app_handle: tauri::AppHandle,
    vault: String,
    ids: Vec<String>,
) -> Result<(), String> {
    super::run_blocking(move || reorder_tasks_impl(app_handle, vault, ids)).await
}
