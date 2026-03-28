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

#[derive(Serialize, Deserialize, Debug)]
pub struct VaultIndex {
    pub version: u32,
    pub items: Vec<BoardItem>,
    #[serde(default)]
    pub collections: Vec<Collection>,
}

impl VaultIndex {
    pub fn new() -> Self {
        Self {
            version: 1,
            items: Vec::new(),
            collections: Vec::new(),
        }
    }
}
