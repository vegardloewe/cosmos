use std::fs;
use std::path::Path;

use serde::Deserialize;

use super::vault::{read_index, write_index};

fn get_openai_api_key() -> Result<String, String> {
    std::env::var("OPENAI_API_KEY")
        .map_err(|_| "OPENAI_API_KEY environment variable not set".to_string())
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

#[derive(Deserialize)]
struct OpenAIResponse {
    choices: Vec<OpenAIChoice>,
}

#[derive(Deserialize)]
struct OpenAIChoice {
    message: OpenAIMessage,
}

#[derive(Deserialize)]
struct OpenAIMessage {
    content: Option<String>,
}

#[derive(Deserialize)]
struct ImageAIResult {
    title: String,
    description: String,
    tags: Vec<String>,
}

fn do_auto_enrich(vault: &str, item_id: &str) -> Result<(), String> {
    let index = read_index(vault)?;
    let item = index
        .items
        .iter()
        .find(|i| i.id == item_id)
        .ok_or_else(|| "Item not found".to_string())?;

    let client = reqwest::blocking::Client::new();

    let is_image = item.item_type == "image";

    let body = match item.item_type.as_str() {
        "image" => {
            let asset_path = item
                .asset_path
                .as_ref()
                .ok_or("No image asset")?;
            let full_path = Path::new(vault)
                .join(".moodboard")
                .join("assets")
                .join(asset_path);
            let bytes = fs::read(&full_path)
                .map_err(|e| format!("Failed to read image: {}", e))?;

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
                _ => "image/png",
            };

            let b64 = base64_encode(&bytes);

            serde_json::json!({
                "model": "gpt-5.4-nano",
                "messages": [{
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Analyze this image and return a JSON object with exactly these fields:\n- \"title\": a short, descriptive title (3-8 words)\n- \"description\": a one-sentence description of the image\n- \"tags\": an array of 3-6 lowercase tags (single words or short hyphenated phrases, focusing on subject, style, mood, colors)\n\nReturn ONLY the JSON object, nothing else. Example: {\"title\": \"Minimal Concrete House\", \"description\": \"A brutalist concrete residence with clean geometric lines set against a cloudy sky.\", \"tags\": [\"minimalist\", \"architecture\", \"concrete\", \"brutalism\"]}"
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": format!("data:{};base64,{}", mime, b64),
                                "detail": "low"
                            }
                        }
                    ]
                }],
                "max_completion_tokens": 200
            })
        }
        "link" => {
            let title = item.link_title.as_deref().unwrap_or("");
            let description = item.link_description.as_deref().unwrap_or("");
            let url = item.url.as_deref().unwrap_or("");

            serde_json::json!({
                "model": "gpt-5.4-nano",
                "messages": [{
                    "role": "user",
                    "content": format!(
                        "Generate 3-6 short, descriptive tags for this link.\nTitle: {}\nDescription: {}\nURL: {}\n\nTags should be lowercase, single words or short hyphenated phrases. Focus on topic, category, and key themes. Return ONLY a JSON array of strings, nothing else.",
                        title, description, url
                    )
                }],
                "max_completion_tokens": 100
            })
        }
        "text" => {
            let title = item.title.as_deref().unwrap_or("");
            let excerpt = item.excerpt.as_deref().unwrap_or("");

            serde_json::json!({
                "model": "gpt-5.4-nano",
                "messages": [{
                    "role": "user",
                    "content": format!(
                        "Generate 3-6 short, descriptive tags for this note.\nTitle: {}\nContent: {}\n\nTags should be lowercase, single words or short hyphenated phrases. Focus on topic, category, and key themes. Return ONLY a JSON array of strings, nothing else.",
                        title, excerpt
                    )
                }],
                "max_completion_tokens": 100
            })
        }
        "video" => return Ok(()), // skip AI enrichment for videos
        _ => return Err("Unknown item type".to_string()),
    };

    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", get_openai_api_key()?))
        .json(&body)
        .send()
        .map_err(|e| format!("API request failed: {}", e))?;

    let status = response.status();
    let response_text = response.text().map_err(|e| format!("Failed to read response: {}", e))?;

    if !status.is_success() {
        return Err(format!("OpenAI API error ({}): {}", status, response_text));
    }

    let parsed: OpenAIResponse =
        serde_json::from_str(&response_text).map_err(|e| format!("Failed to parse response: {}", e))?;

    let content = parsed
        .choices
        .first()
        .and_then(|c| c.message.content.as_ref())
        .ok_or("Empty response from AI")?;

    let trimmed = content.trim();

    // Update the index
    let mut index = read_index(vault)?;
    let item = index
        .items
        .iter_mut()
        .find(|i| i.id == item_id)
        .ok_or_else(|| "Item not found".to_string())?;

    if is_image {
        // Parse as full object with title, description, tags
        let result: ImageAIResult = serde_json::from_str(trimmed)
            .map_err(|_| format!("Failed to parse AI response: {}", trimmed))?;

        if item.title.is_none() || item.title.as_deref() == Some("") {
            item.title = Some(result.title);
        }
        if item.link_description.is_none() || item.link_description.as_deref() == Some("") {
            item.link_description = Some(result.description);
        }
        for tag in &result.tags {
            let lower = tag.to_lowercase();
            if !item.tags.iter().any(|t| t.to_lowercase() == lower) {
                item.tags.push(lower);
            }
        }
    } else {
        // Parse as tags array only
        let tags: Vec<String> = serde_json::from_str(trimmed)
            .map_err(|_| format!("Failed to parse tags from AI response: {}", trimmed))?;

        for tag in &tags {
            let lower = tag.to_lowercase();
            if !item.tags.iter().any(|t| t.to_lowercase() == lower) {
                item.tags.push(lower);
            }
        }
    }

    write_index(vault, &index)?;
    Ok(())
}

/// Spawns auto-enrichment on a separate thread so it never blocks the Tauri command thread pool.
#[tauri::command]
pub fn auto_tag_item(vault: String, item_id: String) -> Result<(), String> {
    if get_openai_api_key().is_err() {
        return Err("OPENAI_API_KEY environment variable not set".to_string());
    }

    std::thread::spawn(move || {
        match do_auto_enrich(&vault, &item_id) {
            Ok(()) => eprintln!("[ai] enriched {}", item_id),
            Err(e) => eprintln!("[ai] auto-enrich failed for {}: {}", item_id, e),
        }
    });

    Ok(())
}
