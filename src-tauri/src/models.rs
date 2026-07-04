use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Collection {
    pub id: String,
    pub name: String,
    pub color: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BoardItem {
    pub id: String,
    #[serde(rename = "type")]
    pub item_type: String, // "image", "video", "link", "text"
    pub created_at: String,
    pub updated_at: String,
    pub tags: Vec<String>,
    #[serde(default)]
    pub collection_ids: Vec<String>,
    pub color: Option<String>,
    // image/video
    pub asset_path: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    // link
    pub url: Option<String>,
    pub link_title: Option<String>,
    pub link_description: Option<String>,
    pub link_preview_path: Option<String>,
    // text
    pub note_path: Option<String>,
    pub title: Option<String>,
    pub excerpt: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Book {
    pub id: String,
    pub title: String,
    pub author: Option<String>,
    pub cover_path: Option<String>,
    pub status: String, // "reading" | "read" | "want"
    pub year_read: Option<i32>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Goal {
    pub id: String,
    pub title: String,
    pub category: String,
    pub achieved: bool,
    pub progress_current: Option<f64>,
    pub progress_target: Option<f64>,
    pub year: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TaskProject {
    pub id: String,
    pub name: String,
    pub color: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String, // "backlog" | "in_progress" | "done"
    pub priority: Option<String>, // "urgent" | "high" | "medium" | "low"
    pub effort: Option<String>,   // "s" | "m" | "l" | "xl"
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct VaultIndex {
    pub version: u32,
    pub items: Vec<BoardItem>,
    #[serde(default)]
    pub collections: Vec<Collection>,
    #[serde(default)]
    pub books: Vec<Book>,
    #[serde(default)]
    pub goals: Vec<Goal>,
    // Alias keeps index files written before the camelCase rename loading
    #[serde(default, alias = "task_projects")]
    pub task_projects: Vec<TaskProject>,
    #[serde(default)]
    pub tasks: Vec<Task>,
}

impl VaultIndex {
    pub fn new() -> Self {
        Self {
            version: 1,
            items: Vec::new(),
            collections: Vec::new(),
            books: Vec::new(),
            goals: Vec::new(),
            task_projects: Vec::new(),
            tasks: Vec::new(),
        }
    }
}
