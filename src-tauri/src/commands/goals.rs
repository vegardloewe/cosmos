use crate::models::Goal;
use super::vault::{read_index, write_index};

fn now_millis() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis()
        .to_string()
}

fn add_goal_impl(
    vault: String,
    title: String,
    category: String,
    year: i32,
    progress_current: Option<f64>,
    progress_target: Option<f64>,
) -> Result<Goal, String> {
    let now = now_millis();
    let goal = Goal {
        id: nanoid::nanoid!(),
        title,
        category,
        achieved: false,
        progress_current,
        progress_target,
        year,
        created_at: now.clone(),
        updated_at: now,
    };

    let mut index = read_index(&vault)?;
    index.goals.push(goal.clone());
    write_index(&vault, &index)?;

    Ok(goal)
}

fn update_goal_impl(vault: String, goal: Goal) -> Result<(), String> {
    let mut index = read_index(&vault)?;

    let existing = index
        .goals
        .iter_mut()
        .find(|g| g.id == goal.id)
        .ok_or_else(|| format!("Goal not found: {}", goal.id))?;

    *existing = Goal {
        updated_at: now_millis(),
        ..goal
    };

    write_index(&vault, &index)?;
    Ok(())
}

fn delete_goal_impl(vault: String, id: String) -> Result<(), String> {
    let mut index = read_index(&vault)?;
    index.goals.retain(|g| g.id != id);
    write_index(&vault, &index)?;
    Ok(())
}

#[tauri::command]
pub async fn add_goal(
    vault: String,
    title: String,
    category: String,
    year: i32,
    progress_current: Option<f64>,
    progress_target: Option<f64>,
) -> Result<Goal, String> {
    super::run_blocking(move || {
        add_goal_impl(vault, title, category, year, progress_current, progress_target)
    })
    .await
}

#[tauri::command]
pub async fn update_goal(vault: String, goal: Goal) -> Result<(), String> {
    super::run_blocking(move || update_goal_impl(vault, goal)).await
}

#[tauri::command]
pub async fn delete_goal(vault: String, id: String) -> Result<(), String> {
    super::run_blocking(move || delete_goal_impl(vault, id)).await
}
