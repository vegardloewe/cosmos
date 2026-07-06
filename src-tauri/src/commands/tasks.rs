use crate::models::{Task, TaskProject};
use super::vault::{read_index, write_index};

fn now_millis() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis()
        .to_string()
}

fn add_task_project_impl(vault: String, name: String, color: String) -> Result<TaskProject, String> {
    let project = TaskProject {
        id: nanoid::nanoid!(),
        name,
        color,
    };

    let mut index = read_index(&vault)?;
    index.task_projects.push(project.clone());
    write_index(&vault, &index)?;

    Ok(project)
}

fn delete_task_project_impl(vault: String, id: String) -> Result<(), String> {
    let mut index = read_index(&vault)?;
    index.task_projects.retain(|p| p.id != id);
    index.tasks.retain(|t| t.project_id != id);
    write_index(&vault, &index)?;
    Ok(())
}

fn add_task_impl(
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
        completed_at: if status == "done" { Some(now.clone()) } else { None },
        status,
        priority,
        effort,
        deadline,
        created_at: now.clone(),
        updated_at: now,
    };

    let mut index = read_index(&vault)?;
    index.tasks.push(task.clone());
    write_index(&vault, &index)?;

    Ok(task)
}

fn update_task_impl(vault: String, task: Task) -> Result<(), String> {
    let mut index = read_index(&vault)?;

    let existing = index
        .tasks
        .iter_mut()
        .find(|t| t.id == task.id)
        .ok_or_else(|| format!("Task not found: {}", task.id))?;

    *existing = Task {
        updated_at: now_millis(),
        ..task
    };

    write_index(&vault, &index)?;
    Ok(())
}

fn delete_task_impl(vault: String, id: String) -> Result<(), String> {
    let mut index = read_index(&vault)?;
    index.tasks.retain(|t| t.id != id);
    write_index(&vault, &index)?;
    Ok(())
}

/// Persist a manual ordering: sort the tasks array by the given id list
fn reorder_tasks_impl(vault: String, ids: Vec<String>) -> Result<(), String> {
    use std::collections::HashMap;

    let positions: HashMap<&str, usize> = ids
        .iter()
        .enumerate()
        .map(|(i, id)| (id.as_str(), i))
        .collect();

    let mut index = read_index(&vault)?;
    index
        .tasks
        .sort_by_key(|t| positions.get(t.id.as_str()).copied().unwrap_or(usize::MAX));
    write_index(&vault, &index)?;
    Ok(())
}

#[tauri::command]
pub async fn add_task_project(vault: String, name: String, color: String) -> Result<TaskProject, String> {
    super::run_blocking(move || add_task_project_impl(vault, name, color)).await
}

#[tauri::command]
pub async fn delete_task_project(vault: String, id: String) -> Result<(), String> {
    super::run_blocking(move || delete_task_project_impl(vault, id)).await
}

#[tauri::command]
pub async fn add_task(
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
        add_task_impl(vault, project_id, title, description, status, priority, effort, deadline)
    })
    .await
}

#[tauri::command]
pub async fn update_task(vault: String, task: Task) -> Result<(), String> {
    super::run_blocking(move || update_task_impl(vault, task)).await
}

#[tauri::command]
pub async fn delete_task(vault: String, id: String) -> Result<(), String> {
    super::run_blocking(move || delete_task_impl(vault, id)).await
}

#[tauri::command]
pub async fn reorder_tasks(vault: String, ids: Vec<String>) -> Result<(), String> {
    super::run_blocking(move || reorder_tasks_impl(vault, ids)).await
}
