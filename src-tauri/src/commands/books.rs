use std::fs;
use std::path::Path;

use serde::Serialize;

use crate::models::Book;
use super::vault::{read_index, write_index};

const BROWSER_UA: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

fn now_millis() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis()
        .to_string()
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BookSearchResult {
    pub title: String,
    pub author: Option<String>,
    pub cover_url: Option<String>,
    pub first_publish_year: Option<i64>,
}

/// Search Open Library for books matching the query
fn search_books_impl(query: String) -> Result<Vec<BookSearchResult>, String> {
    let client = reqwest::blocking::Client::builder()
        .user_agent(BROWSER_UA)
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .unwrap_or_else(|_| reqwest::blocking::Client::new());

    let response = client
        .get("https://openlibrary.org/search.json")
        .query(&[
            ("q", query.as_str()),
            ("limit", "12"),
            ("fields", "title,author_name,cover_i,first_publish_year"),
        ])
        .send()
        .map_err(|e| format!("Failed to search books: {}", e))?;

    let body = response
        .text()
        .map_err(|e| format!("Failed to read search response: {}", e))?;

    let parsed: serde_json::Value = serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse search response: {}", e))?;

    let docs = parsed["docs"].as_array().cloned().unwrap_or_default();

    let results = docs
        .iter()
        .filter_map(|doc| {
            let title = doc["title"].as_str()?.to_string();
            let author = doc["author_name"]
                .as_array()
                .and_then(|a| a.first())
                .and_then(|a| a.as_str())
                .map(|s| s.to_string());
            let cover_url = doc["cover_i"]
                .as_i64()
                .map(|id| format!("https://covers.openlibrary.org/b/id/{}-L.jpg", id));
            let first_publish_year = doc["first_publish_year"].as_i64();
            Some(BookSearchResult {
                title,
                author,
                cover_url,
                first_publish_year,
            })
        })
        .collect();

    Ok(results)
}

fn download_cover(vault: &str, id: &str, cover_url: &str) -> Result<String, String> {
    let client = reqwest::blocking::Client::builder()
        .user_agent(BROWSER_UA)
        .redirect(reqwest::redirect::Policy::limited(10))
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .unwrap_or_else(|_| reqwest::blocking::Client::new());

    let response = client.get(cover_url).send()
        .map_err(|e| format!("Failed to download cover: {}", e))?;

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

    let filename = format!("{}-cover.{}", id, ext);
    let dest = Path::new(vault)
        .join(".moodboard")
        .join("assets")
        .join(&filename);

    let bytes = response
        .bytes()
        .map_err(|e| format!("Failed to read cover bytes: {}", e))?;

    fs::write(&dest, &bytes)
        .map_err(|e| format!("Failed to write cover image: {}", e))?;

    Ok(filename)
}

fn add_book_impl(
    vault: String,
    title: String,
    author: Option<String>,
    cover_url: Option<String>,
    status: String,
    year_read: Option<i32>,
) -> Result<Book, String> {
    let id = nanoid::nanoid!();

    let cover_path = cover_url.as_deref().and_then(|url| {
        // Non-fatal: a book without a cover still gets added
        download_cover(&vault, &id, url).ok()
    });

    let now = now_millis();
    let book = Book {
        id,
        title,
        author,
        cover_path,
        status,
        year_read,
        created_at: now.clone(),
        updated_at: now,
    };

    let mut index = read_index(&vault)?;
    // Newest first: array order is the display order
    index.books.insert(0, book.clone());
    write_index(&vault, &index)?;

    Ok(book)
}

/// Persist a manual ordering: sort the books array by the given id list
fn reorder_books_impl(vault: String, ids: Vec<String>) -> Result<(), String> {
    use std::collections::HashMap;

    let positions: HashMap<&str, usize> = ids
        .iter()
        .enumerate()
        .map(|(i, id)| (id.as_str(), i))
        .collect();

    let mut index = read_index(&vault)?;
    index
        .books
        .sort_by_key(|b| positions.get(b.id.as_str()).copied().unwrap_or(usize::MAX));
    write_index(&vault, &index)?;
    Ok(())
}

fn update_book_impl(vault: String, book: Book) -> Result<(), String> {
    let mut index = read_index(&vault)?;

    let existing = index
        .books
        .iter_mut()
        .find(|b| b.id == book.id)
        .ok_or_else(|| format!("Book not found: {}", book.id))?;

    *existing = Book {
        updated_at: now_millis(),
        ..book
    };

    write_index(&vault, &index)?;
    Ok(())
}

/// Set a book's cover from a local image file, replacing any existing cover
fn set_book_cover_impl(vault: String, id: String, source: String) -> Result<Book, String> {
    let mut index = read_index(&vault)?;

    let book = index
        .books
        .iter_mut()
        .find(|b| b.id == id)
        .ok_or_else(|| format!("Book not found: {}", id))?;

    let assets_dir = Path::new(&vault).join(".moodboard").join("assets");

    if let Some(ref old) = book.cover_path {
        let _ = fs::remove_file(assets_dir.join(old));
    }

    let ext = Path::new(&source)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg")
        .to_lowercase();
    // Random suffix so the filename changes and the frontend reloads the image
    let filename = format!("{}-cover-{}.{}", id, nanoid::nanoid!(6), ext);

    fs::copy(&source, assets_dir.join(&filename))
        .map_err(|e| format!("Failed to copy cover image: {}", e))?;

    book.cover_path = Some(filename);
    book.updated_at = now_millis();
    let updated = book.clone();

    write_index(&vault, &index)?;
    Ok(updated)
}

fn delete_book_impl(vault: String, id: String) -> Result<(), String> {
    let mut index = read_index(&vault)?;

    if let Some(book) = index.books.iter().find(|b| b.id == id) {
        if let Some(ref cover) = book.cover_path {
            let path = Path::new(&vault).join(".moodboard").join("assets").join(cover);
            let _ = fs::remove_file(path);
        }
    }

    index.books.retain(|b| b.id != id);
    write_index(&vault, &index)?;
    Ok(())
}

// Async wrappers: run the blocking bodies on the thread pool so the UI never stalls

#[tauri::command]
pub async fn search_books(query: String) -> Result<Vec<BookSearchResult>, String> {
    super::run_blocking(move || search_books_impl(query)).await
}

#[tauri::command]
pub async fn add_book(
    vault: String,
    title: String,
    author: Option<String>,
    cover_url: Option<String>,
    status: String,
    year_read: Option<i32>,
) -> Result<Book, String> {
    super::run_blocking(move || add_book_impl(vault, title, author, cover_url, status, year_read)).await
}

#[tauri::command]
pub async fn update_book(vault: String, book: Book) -> Result<(), String> {
    super::run_blocking(move || update_book_impl(vault, book)).await
}

#[tauri::command]
pub async fn reorder_books(vault: String, ids: Vec<String>) -> Result<(), String> {
    super::run_blocking(move || reorder_books_impl(vault, ids)).await
}

#[tauri::command]
pub async fn set_book_cover(vault: String, id: String, source: String) -> Result<Book, String> {
    super::run_blocking(move || set_book_cover_impl(vault, id, source)).await
}

#[tauri::command]
pub async fn delete_book(vault: String, id: String) -> Result<(), String> {
    super::run_blocking(move || delete_book_impl(vault, id)).await
}
