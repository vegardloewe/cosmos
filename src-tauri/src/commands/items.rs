use std::fs;
use std::path::{Path, PathBuf};

use tauri::Manager;

use crate::models::BoardItem;
use super::vault::{read_index, write_index};

/// Board cards are at most a few hundred points wide, so a thumbnail capped at
/// this many pixels still covers a 2x display with room to spare.
const THUMB_MAX_DIM: u32 = 800;

fn read_asset_impl(vault: String, asset_path: String) -> Result<String, String> {
    let full_path = Path::new(&vault)
        .join(".moodboard")
        .join("assets")
        .join(&asset_path);
    let bytes = fs::read(&full_path)
        .map_err(|e| format!("Failed to read asset: {}", e))?;

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
        "svg" => "image/svg+xml",
        "bmp" => "image/bmp",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "mov" => "video/quicktime",
        "mkv" => "video/x-matroska",
        "avi" => "video/x-msvideo",
        _ => "application/octet-stream",
    };

    Ok(data_url(mime, &bytes))
}

fn data_url(mime: &str, bytes: &[u8]) -> String {
    format!("data:{};base64,{}", mime, base64_encode(bytes))
}

/// True when the thumbnail exists and is at least as new as the file it came
/// from, so an asset replaced on disk regenerates instead of serving a stale one.
fn thumbnail_is_fresh(cached: &Path, source: &Path) -> bool {
    let (Ok(cached_at), Ok(source_at)) = (
        fs::metadata(cached).and_then(|m| m.modified()),
        fs::metadata(source).and_then(|m| m.modified()),
    ) else {
        return false;
    };
    cached_at >= source_at
}

/// A downscaled still of an asset, generated once and cached outside the vault
/// (it is derived data — no reason to sync it to iCloud). Falls back to the
/// original bytes for anything that is already small or that we cannot decode.
fn read_thumbnail_impl(
    vault: String,
    asset_path: String,
    cache_dir: PathBuf,
) -> Result<String, String> {
    let source = Path::new(&vault)
        .join(".moodboard")
        .join("assets")
        .join(&asset_path);

    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    // SVG is resolution independent, and decoders for the rest aren't compiled in.
    if !matches!(ext.as_str(), "png" | "jpg" | "jpeg" | "gif" | "webp") {
        return read_asset_impl(vault, asset_path);
    }

    // GIFs are always re-encoded, even small ones: decoding keeps just the first
    // frame, which is what stops board cards animating when nobody is looking.
    if ext != "gif" {
        if let Ok((w, h)) = image::image_dimensions(&source) {
            if w <= THUMB_MAX_DIM && h <= THUMB_MAX_DIM {
                return read_asset_impl(vault, asset_path);
            }
        }
    }

    let has_alpha = matches!(ext.as_str(), "png" | "gif" | "webp");
    let (thumb_ext, mime) = if has_alpha {
        ("png", "image/png")
    } else {
        ("jpg", "image/jpeg")
    };

    let stem = Path::new(&asset_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or_else(|| "Invalid asset name".to_string())?;
    let cached = cache_dir.join(format!("{}.{}", stem, thumb_ext));

    if !thumbnail_is_fresh(&cached, &source) {
        fs::create_dir_all(&cache_dir)
            .map_err(|e| format!("Failed to create thumbnail cache: {}", e))?;
        let img = image::open(&source).map_err(|e| format!("Failed to decode image: {}", e))?;
        let thumb = img.thumbnail(THUMB_MAX_DIM, THUMB_MAX_DIM);
        let written = if has_alpha {
            thumb.into_rgba8().save(&cached)
        } else {
            thumb.into_rgb8().save(&cached)
        };
        written.map_err(|e| format!("Failed to write thumbnail: {}", e))?;
    }

    let bytes = fs::read(&cached).map_err(|e| format!("Failed to read thumbnail: {}", e))?;
    Ok(data_url(mime, &bytes))
}

fn read_asset_bytes_impl(vault: String, asset_path: String) -> Result<tauri::ipc::Response, String> {
    let full_path = Path::new(&vault)
        .join(".moodboard")
        .join("assets")
        .join(&asset_path);
    let bytes = fs::read(&full_path)
        .map_err(|e| format!("Failed to read asset: {}", e))?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
pub fn get_asset_path(vault: String, asset_path: String) -> Result<String, String> {
    let full_path = Path::new(&vault)
        .join(".moodboard")
        .join("assets")
        .join(&asset_path);
    full_path
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Invalid path".to_string())
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

fn now_millis() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis()
        .to_string()
}

fn import_image_impl(vault: String, source: String) -> Result<BoardItem, String> {
    let source_path = Path::new(&source);

    let ext = source_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase();

    let id = nanoid::nanoid!();
    let filename = format!("{}.{}", id, ext);
    let dest = Path::new(&vault)
        .join(".moodboard")
        .join("assets")
        .join(&filename);

    fs::copy(&source_path, &dest)
        .map_err(|e| format!("Failed to copy image: {}", e))?;

    // Read image dimensions
    let (width, height) = match image::image_dimensions(&dest) {
        Ok((w, h)) => (Some(w), Some(h)),
        Err(_) => (None, None),
    };

    let now = now_millis();
    let item = BoardItem {
        id,
        item_type: "image".to_string(),
        created_at: now.clone(),
        updated_at: now,
        tags: Vec::new(),
        collection_ids: Vec::new(),
        color: None,
        asset_path: Some(filename),
        width,
        height,
        url: None,
        link_title: None,
        link_description: None,
        link_preview_path: None,
        note_path: None,
        title: None,
        excerpt: None,
    };

    let mut index = read_index(&vault)?;
    index.items.push(item.clone());
    write_index(&vault, &index)?;

    Ok(item)
}

fn import_image_data_impl(vault: String, data: Vec<u8>, ext: String) -> Result<BoardItem, String> {
    let id = nanoid::nanoid!();
    let filename = format!("{}.{}", id, ext);
    let dest = Path::new(&vault)
        .join(".moodboard")
        .join("assets")
        .join(&filename);

    fs::write(&dest, &data)
        .map_err(|e| format!("Failed to write image data: {}", e))?;

    let (width, height) = match image::image_dimensions(&dest) {
        Ok((w, h)) => (Some(w), Some(h)),
        Err(_) => (None, None),
    };

    let now = now_millis();
    let item = BoardItem {
        id,
        item_type: "image".to_string(),
        created_at: now.clone(),
        updated_at: now,
        tags: Vec::new(),
        collection_ids: Vec::new(),
        color: None,
        asset_path: Some(filename),
        width,
        height,
        url: None,
        link_title: None,
        link_description: None,
        link_preview_path: None,
        note_path: None,
        title: None,
        excerpt: None,
    };

    let mut index = read_index(&vault)?;
    index.items.push(item.clone());
    write_index(&vault, &index)?;

    Ok(item)
}

fn import_video_impl(vault: String, source: String) -> Result<BoardItem, String> {
    let source_path = Path::new(&source);

    let ext = source_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("mp4")
        .to_lowercase();

    let id = nanoid::nanoid!();
    let filename = format!("{}.{}", id, ext);
    let dest = Path::new(&vault)
        .join(".moodboard")
        .join("assets")
        .join(&filename);

    fs::copy(&source_path, &dest)
        .map_err(|e| format!("Failed to copy video: {}", e))?;

    let now = now_millis();
    let item = BoardItem {
        id,
        item_type: "video".to_string(),
        created_at: now.clone(),
        updated_at: now,
        tags: Vec::new(),
        collection_ids: Vec::new(),
        color: None,
        asset_path: Some(filename),
        width: None,
        height: None,
        url: None,
        link_title: None,
        link_description: None,
        link_preview_path: None,
        note_path: None,
        title: None,
        excerpt: None,
    };

    let mut index = read_index(&vault)?;
    index.items.push(item.clone());
    write_index(&vault, &index)?;

    Ok(item)
}

fn import_video_data_impl(vault: String, data: Vec<u8>, ext: String) -> Result<BoardItem, String> {
    let id = nanoid::nanoid!();
    let filename = format!("{}.{}", id, ext);
    let dest = Path::new(&vault)
        .join(".moodboard")
        .join("assets")
        .join(&filename);

    fs::write(&dest, &data)
        .map_err(|e| format!("Failed to write video data: {}", e))?;

    let now = now_millis();
    let item = BoardItem {
        id,
        item_type: "video".to_string(),
        created_at: now.clone(),
        updated_at: now,
        tags: Vec::new(),
        collection_ids: Vec::new(),
        color: None,
        asset_path: Some(filename),
        width: None,
        height: None,
        url: None,
        link_title: None,
        link_description: None,
        link_preview_path: None,
        note_path: None,
        title: None,
        excerpt: None,
    };

    let mut index = read_index(&vault)?;
    index.items.push(item.clone());
    write_index(&vault, &index)?;

    Ok(item)
}

fn add_note_impl(vault: String, title: String, content: String) -> Result<BoardItem, String> {
    let id = nanoid::nanoid!();
    let filename = format!("{}.md", id);
    let dest = Path::new(&vault)
        .join(".moodboard")
        .join("notes")
        .join(&filename);

    fs::write(&dest, &content)
        .map_err(|e| format!("Failed to write note: {}", e))?;

    let excerpt = if content.len() > 100 {
        format!("{}...", &content[..100])
    } else {
        content.clone()
    };

    let now = now_millis();
    let item = BoardItem {
        id,
        item_type: "text".to_string(),
        created_at: now.clone(),
        updated_at: now,
        tags: Vec::new(),
        collection_ids: Vec::new(),
        color: None,
        asset_path: None,
        width: None,
        height: None,
        url: None,
        link_title: None,
        link_description: None,
        link_preview_path: None,
        note_path: Some(filename),
        title: Some(title),
        excerpt: Some(excerpt),
    };

    let mut index = read_index(&vault)?;
    index.items.push(item.clone());
    write_index(&vault, &index)?;

    Ok(item)
}

fn update_item_impl(vault: String, item: BoardItem) -> Result<(), String> {
    let mut index = read_index(&vault)?;

    let pos = index
        .items
        .iter()
        .position(|i| i.id == item.id)
        .ok_or_else(|| format!("Item not found: {}", item.id))?;

    let mut updated = item;
    updated.updated_at = now_millis();
    index.items[pos] = updated;

    write_index(&vault, &index)?;
    Ok(())
}

fn delete_item_impl(vault: String, id: String) -> Result<(), String> {
    let mut index = read_index(&vault)?;

    let pos = index
        .items
        .iter()
        .position(|i| i.id == id)
        .ok_or_else(|| format!("Item not found: {}", id))?;

    let item = &index.items[pos];
    let moodboard_dir = Path::new(&vault).join(".moodboard");

    // Delete associated file
    if let Some(ref asset) = item.asset_path {
        let asset_file = moodboard_dir.join("assets").join(asset);
        if asset_file.exists() {
            fs::remove_file(&asset_file)
                .map_err(|e| format!("Failed to delete asset: {}", e))?;
        }
    }
    if let Some(ref note) = item.note_path {
        let note_file = moodboard_dir.join("notes").join(note);
        if note_file.exists() {
            fs::remove_file(&note_file)
                .map_err(|e| format!("Failed to delete note: {}", e))?;
        }
    }
    if let Some(ref preview) = item.link_preview_path {
        let preview_file = moodboard_dir.join("assets").join(preview);
        if preview_file.exists() {
            fs::remove_file(&preview_file)
                .map_err(|e| format!("Failed to delete link preview: {}", e))?;
        }
    }

    index.items.remove(pos);
    write_index(&vault, &index)?;

    Ok(())
}

// Async wrappers: run the blocking bodies on the thread pool so the UI never stalls

#[tauri::command]
pub async fn read_asset(vault: String, asset_path: String) -> Result<String, String> {
    super::run_blocking(move || read_asset_impl(vault, asset_path)).await
}

#[tauri::command]
pub async fn read_thumbnail(
    app: tauri::AppHandle,
    vault: String,
    asset_path: String,
) -> Result<String, String> {
    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| format!("No cache directory: {}", e))?
        .join("thumbnails");
    super::run_blocking(move || read_thumbnail_impl(vault, asset_path, cache_dir)).await
}

#[tauri::command]
pub async fn read_asset_bytes(vault: String, asset_path: String) -> Result<tauri::ipc::Response, String> {
    super::run_blocking(move || read_asset_bytes_impl(vault, asset_path)).await
}

#[tauri::command]
pub async fn import_image(vault: String, source: String) -> Result<BoardItem, String> {
    super::run_blocking(move || import_image_impl(vault, source)).await
}

#[tauri::command]
pub async fn import_image_data(vault: String, data: Vec<u8>, ext: String) -> Result<BoardItem, String> {
    super::run_blocking(move || import_image_data_impl(vault, data, ext)).await
}

#[tauri::command]
pub async fn import_video(vault: String, source: String) -> Result<BoardItem, String> {
    super::run_blocking(move || import_video_impl(vault, source)).await
}

#[tauri::command]
pub async fn import_video_data(vault: String, data: Vec<u8>, ext: String) -> Result<BoardItem, String> {
    super::run_blocking(move || import_video_data_impl(vault, data, ext)).await
}

#[tauri::command]
pub async fn add_note(vault: String, title: String, content: String) -> Result<BoardItem, String> {
    super::run_blocking(move || add_note_impl(vault, title, content)).await
}

#[tauri::command]
pub async fn update_item(vault: String, item: BoardItem) -> Result<(), String> {
    super::run_blocking(move || update_item_impl(vault, item)).await
}

#[tauri::command]
pub async fn delete_item(vault: String, id: String) -> Result<(), String> {
    super::run_blocking(move || delete_item_impl(vault, id)).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{Rgb, RgbImage, Rgba, RgbaImage};

    struct Fixture {
        root: PathBuf,
    }

    impl Fixture {
        fn new() -> Self {
            let root = std::env::temp_dir().join(format!("cosmos-thumb-{}", nanoid::nanoid!()));
            fs::create_dir_all(root.join("vault").join(".moodboard").join("assets")).unwrap();
            fs::create_dir_all(root.join("cache")).unwrap();
            Fixture { root }
        }

        fn vault(&self) -> String {
            self.root.join("vault").to_str().unwrap().to_string()
        }

        fn cache(&self) -> PathBuf {
            self.root.join("cache")
        }

        fn asset(&self, name: &str) -> PathBuf {
            self.root
                .join("vault")
                .join(".moodboard")
                .join("assets")
                .join(name)
        }

        fn thumbnail(&self, name: &str) -> Result<String, String> {
            read_thumbnail_impl(self.vault(), name.to_string(), self.cache())
        }
    }

    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    /// Decodes a data URL back into an image so tests can assert on real pixels.
    fn decode(data_url: &str) -> image::DynamicImage {
        let payload = data_url.split_once("base64,").expect("not a data url").1;
        const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let mut bits = Vec::new();
        for byte in payload.bytes().filter(|b| *b != b'=') {
            bits.push(CHARS.iter().position(|c| *c == byte).unwrap() as u32);
        }
        let mut bytes = Vec::new();
        for chunk in bits.chunks(4) {
            let mut triple = 0u32;
            for (i, v) in chunk.iter().enumerate() {
                triple |= v << (18 - 6 * i);
            }
            bytes.push((triple >> 16) as u8);
            if chunk.len() > 2 {
                bytes.push((triple >> 8) as u8);
            }
            if chunk.len() > 3 {
                bytes.push(triple as u8);
            }
        }
        image::load_from_memory(&bytes).expect("thumbnail is not a decodable image")
    }

    #[test]
    fn large_photo_is_downscaled_to_jpeg() {
        let fixture = Fixture::new();
        RgbImage::from_pixel(2400, 1200, Rgb([12, 34, 56]))
            .save(fixture.asset("big.jpg"))
            .unwrap();

        let url = fixture.thumbnail("big.jpg").unwrap();
        assert!(url.starts_with("data:image/jpeg;base64,"));

        let thumb = decode(&url);
        assert_eq!(thumb.width(), THUMB_MAX_DIM);
        assert_eq!(thumb.height(), THUMB_MAX_DIM / 2, "aspect ratio preserved");
    }

    #[test]
    fn transparency_survives_as_png() {
        let fixture = Fixture::new();
        RgbaImage::from_pixel(1600, 1600, Rgba([255, 0, 0, 0]))
            .save(fixture.asset("clear.png"))
            .unwrap();

        let url = fixture.thumbnail("clear.png").unwrap();
        assert!(url.starts_with("data:image/png;base64,"));
        assert_eq!(decode(&url).to_rgba8().get_pixel(0, 0)[3], 0);
    }

    #[test]
    fn small_images_are_passed_through_untouched() {
        let fixture = Fixture::new();
        RgbImage::from_pixel(120, 90, Rgb([1, 2, 3]))
            .save(fixture.asset("small.png"))
            .unwrap();

        let url = fixture.thumbnail("small.png").unwrap();
        let thumb = decode(&url);
        assert_eq!((thumb.width(), thumb.height()), (120, 90));
        assert!(
            !fixture.cache().join("small.png").exists(),
            "nothing to downscale, so nothing should be cached"
        );
    }

    #[test]
    fn animated_gifs_are_frozen_to_one_frame() {
        let fixture = Fixture::new();
        let path = fixture.asset("loop.gif");
        {
            let file = fs::File::create(&path).unwrap();
            let mut encoder = image::codecs::gif::GifEncoder::new(file);
            for shade in [0u8, 255u8] {
                let frame = RgbaImage::from_pixel(64, 64, Rgba([shade, shade, shade, 255]));
                encoder
                    .encode_frame(image::Frame::new(frame))
                    .expect("failed to encode frame");
            }
        }

        // Small, but a GIF is re-encoded anyway — that is what drops the animation.
        let url = fixture.thumbnail("loop.gif").unwrap();
        assert!(url.starts_with("data:image/png;base64,"));
        assert!(fixture.cache().join("loop.png").exists());
        assert_eq!(decode(&url).to_rgba8().get_pixel(0, 0)[0], 0, "first frame");
    }

    #[test]
    fn undecodable_formats_fall_back_to_the_original_bytes() {
        let fixture = Fixture::new();
        let svg = b"<svg xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"9\" height=\"9\"/></svg>";
        fs::write(fixture.asset("vector.svg"), svg).unwrap();

        let url = fixture.thumbnail("vector.svg").unwrap();
        assert_eq!(url, data_url("image/svg+xml", svg));
    }

    #[test]
    fn a_replaced_asset_regenerates_its_thumbnail() {
        let fixture = Fixture::new();
        RgbImage::from_pixel(1000, 1000, Rgb([0, 0, 0]))
            .save(fixture.asset("swap.jpg"))
            .unwrap();
        assert_eq!(decode(&fixture.thumbnail("swap.jpg").unwrap()).width(), 800);

        // Same name, different contents and a newer mtime.
        std::thread::sleep(std::time::Duration::from_millis(1100));
        RgbImage::from_pixel(1600, 800, Rgb([255, 255, 255]))
            .save(fixture.asset("swap.jpg"))
            .unwrap();

        let thumb = decode(&fixture.thumbnail("swap.jpg").unwrap());
        assert_eq!((thumb.width(), thumb.height()), (800, 400), "stale cache served");
    }
}
