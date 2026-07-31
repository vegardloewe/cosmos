use serde::{Deserialize, Serialize};

/// The path is deliberately returned as a normal file-system path so the
/// existing Rust vault commands can keep their platform-neutral API.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultDirectory {
    pub path: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultFile {
    pub path: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultFileContents {
    pub content: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteVaultFile {
    pub path: String,
    pub content: String,
}
