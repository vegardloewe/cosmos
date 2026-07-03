use std::fs;
use std::path::Path;

use scraper::{Html, Selector};

use crate::models::BoardItem;
use super::vault::{read_index, write_index};

fn now_millis() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis()
        .to_string()
}

/// Extract content attribute from a meta tag matching the given selector
fn meta_content(document: &Html, selector_str: &str) -> Option<String> {
    let selector = Selector::parse(selector_str).ok()?;
    document
        .select(&selector)
        .next()
        .and_then(|el| el.value().attr("content"))
        .map(|s| s.to_string())
}

const BROWSER_UA: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const BOT_UA: &str = "Twitterbot/1.0";

fn is_twitter_url(url: &str) -> bool {
    if let Ok(parsed) = reqwest::Url::parse(url) {
        let host = parsed.host_str().unwrap_or("");
        return host == "twitter.com" || host == "www.twitter.com"
            || host == "x.com" || host == "www.x.com";
    }
    false
}

/// For Twitter/X URLs, rewrite to fxtwitter.com to get proper OG tags
fn og_fetch_url(url: &str) -> String {
    if let Ok(parsed) = reqwest::Url::parse(url) {
        let host = parsed.host_str().unwrap_or("");
        if host == "twitter.com" || host == "www.twitter.com"
            || host == "x.com" || host == "www.x.com"
        {
            let mut fixed = parsed.clone();
            let _ = fixed.set_host(Some("fxtwitter.com"));
            return fixed.to_string();
        }
    }
    url.to_string()
}

#[tauri::command]
pub async fn import_link(vault: String, url: String) -> Result<BoardItem, String> {
    super::run_blocking(move || import_link_impl(&vault, &url)).await
}

struct LinkMetadata {
    title: Option<String>,
    description: Option<String>,
    preview_path: Option<String>,
}

/// Fetch a page's OG metadata and download its preview image into the vault
fn fetch_metadata(vault: &str, id: &str, url: &str) -> Result<LinkMetadata, String> {
    let is_twitter = is_twitter_url(url);
    let fetch_url = og_fetch_url(url);

    // Use bot UA for fxtwitter (serves OG tags only to bots), browser UA otherwise
    let ua = if is_twitter { BOT_UA } else { BROWSER_UA };
    let client = reqwest::blocking::Client::builder()
        .user_agent(ua)
        .redirect(reqwest::redirect::Policy::none()) // don't follow redirects for fxtwitter
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .unwrap_or_else(|_| reqwest::blocking::Client::new());

    let response = client.get(&fetch_url).send()
        .map_err(|e| format!("Failed to fetch URL: {}", e))?;
    let html = response
        .text()
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    let document = Html::parse_document(&html);

    // Extract Open Graph metadata
    let og_title = meta_content(&document, r#"meta[property="og:title"]"#);
    let og_description = meta_content(&document, r#"meta[property="og:description"]"#);
    let og_image = meta_content(&document, r#"meta[property="og:image"]"#);

    // Fall back to <title> tag if no og:title
    let link_title = og_title.or_else(|| {
        let sel = Selector::parse("title").ok()?;
        document.select(&sel).next().map(|el| el.text().collect())
    });

    // Download preview image if available
    let link_preview_path = if let Some(ref image_url) = og_image {
        match download_preview(vault, id, image_url) {
            Ok(filename) => Some(filename),
            Err(_) => None, // Non-fatal: just skip the preview
        }
    } else {
        None
    };

    Ok(LinkMetadata {
        title: link_title,
        description: og_description,
        preview_path: link_preview_path,
    })
}

/// Fetch a URL's metadata and add it to the vault as a link item.
pub fn import_link_impl(vault: &str, url: &str) -> Result<BoardItem, String> {
    let id = nanoid::nanoid!();
    let meta = fetch_metadata(vault, &id, url)?;

    let now = now_millis();
    let item = BoardItem {
        id,
        item_type: "link".to_string(),
        created_at: now.clone(),
        updated_at: now,
        tags: Vec::new(),
        collection_ids: Vec::new(),
        color: None,
        asset_path: None,
        width: None,
        height: None,
        url: Some(url.to_string()),
        link_title: meta.title,
        link_description: meta.description,
        link_preview_path: meta.preview_path,
        note_path: None,
        title: None,
        excerpt: None,
    };

    let mut index = read_index(vault)?;
    index.items.push(item.clone());
    write_index(vault, &index)?;

    Ok(item)
}

/// Add a bare link item immediately (no network) so captures feel instant;
/// enrich_link_item fills in metadata afterwards.
pub fn create_link_item(vault: &str, url: &str) -> Result<BoardItem, String> {
    let now = now_millis();
    let item = BoardItem {
        id: nanoid::nanoid!(),
        item_type: "link".to_string(),
        created_at: now.clone(),
        updated_at: now,
        tags: Vec::new(),
        collection_ids: Vec::new(),
        color: None,
        asset_path: None,
        width: None,
        height: None,
        url: Some(url.to_string()),
        link_title: Some(url.to_string()),
        link_description: None,
        link_preview_path: None,
        note_path: None,
        title: None,
        excerpt: None,
    };

    let mut index = read_index(vault)?;
    index.items.push(item.clone());
    write_index(vault, &index)?;

    Ok(item)
}

/// Fetch metadata for an existing link item and update it in the index
pub fn enrich_link_item(vault: &str, item_id: &str, url: &str) -> Result<BoardItem, String> {
    let meta = fetch_metadata(vault, item_id, url)?;

    let mut index = read_index(vault)?;
    let item = index
        .items
        .iter_mut()
        .find(|i| i.id == item_id)
        .ok_or_else(|| format!("Item not found: {}", item_id))?;

    if meta.title.is_some() {
        item.link_title = meta.title;
    }
    if meta.description.is_some() {
        item.link_description = meta.description;
    }
    if meta.preview_path.is_some() {
        item.link_preview_path = meta.preview_path;
    }
    item.updated_at = now_millis();
    let updated = item.clone();

    write_index(vault, &index)?;
    Ok(updated)
}

fn download_preview(vault: &str, id: &str, image_url: &str) -> Result<String, String> {
    let client = reqwest::blocking::Client::builder()
        .user_agent(BROWSER_UA)
        .redirect(reqwest::redirect::Policy::limited(10))
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .unwrap_or_else(|_| reqwest::blocking::Client::new());
    let response = client.get(image_url).send()
        .map_err(|e| format!("Failed to download preview image: {}", e))?;

    // Determine extension from content-type or URL
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    let ext = if content_type.contains("png") {
        "png"
    } else if content_type.contains("gif") {
        "gif"
    } else if content_type.contains("webp") {
        "webp"
    } else {
        "jpg"
    };

    let filename = format!("{}-preview.{}", id, ext);
    let dest = Path::new(vault)
        .join(".moodboard")
        .join("assets")
        .join(&filename);

    let bytes = response
        .bytes()
        .map_err(|e| format!("Failed to read preview bytes: {}", e))?;

    fs::write(&dest, &bytes)
        .map_err(|e| format!("Failed to write preview image: {}", e))?;

    Ok(filename)
}
