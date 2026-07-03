import { invoke } from "@tauri-apps/api/core";
import type { Book, BookSearchResult, BookStatus, BoardItem, Collection, VaultIndex } from "../types";

export function createVault(path: string): Promise<void> {
  return invoke("create_vault", { path });
}

export function openVault(path: string): Promise<VaultIndex> {
  return invoke("open_vault", { path });
}

export function getVaultPath(): Promise<string | null> {
  return invoke("get_vault_path");
}

export function setVaultPath(path: string): Promise<void> {
  return invoke("set_vault_path", { path });
}

export function readAsset(vault: string, assetPath: string): Promise<string> {
  return invoke("read_asset", { vault, assetPath });
}

export function readAssetBytes(vault: string, assetPath: string): Promise<ArrayBuffer> {
  return invoke("read_asset_bytes", { vault, assetPath });
}

export function importImage(vault: string, source: string): Promise<BoardItem> {
  return invoke("import_image", { vault, source });
}

export function importImageData(vault: string, data: number[], ext: string): Promise<BoardItem> {
  return invoke("import_image_data", { vault, data, ext });
}

export function getAssetPath(vault: string, assetPath: string): Promise<string> {
  return invoke("get_asset_path", { vault, assetPath });
}

export function importVideo(vault: string, source: string): Promise<BoardItem> {
  return invoke("import_video", { vault, source });
}

export function importVideoData(vault: string, data: number[], ext: string): Promise<BoardItem> {
  return invoke("import_video_data", { vault, data, ext });
}

export function importLink(vault: string, url: string): Promise<BoardItem> {
  return invoke("import_link", { vault, url });
}

export function addNote(vault: string, title: string, content: string): Promise<BoardItem> {
  return invoke("add_note", { vault, title, content });
}

export function updateItem(vault: string, item: BoardItem): Promise<void> {
  return invoke("update_item", { vault, item });
}

export function deleteItem(vault: string, id: string): Promise<void> {
  return invoke("delete_item", { vault, id });
}

export function createCollection(vault: string, name: string, color: string): Promise<Collection> {
  return invoke("create_collection", { vault, name, color });
}

export function deleteCollection(vault: string, id: string): Promise<void> {
  return invoke("delete_collection", { vault, id });
}

export function renameCollection(vault: string, id: string, name: string): Promise<void> {
  return invoke("rename_collection", { vault, id, name });
}

export function autoTagItem(vault: string, itemId: string): Promise<void> {
  return invoke("auto_tag_item", { vault, itemId });
}

export function searchBooks(query: string): Promise<BookSearchResult[]> {
  return invoke("search_books", { query });
}

export function addBook(
  vault: string,
  title: string,
  author: string | null,
  coverUrl: string | null,
  status: BookStatus,
  yearRead: number | null,
): Promise<Book> {
  return invoke("add_book", { vault, title, author, coverUrl, status, yearRead });
}

export function updateBook(vault: string, book: Book): Promise<void> {
  return invoke("update_book", { vault, book });
}

export function setBookCover(vault: string, id: string, source: string): Promise<Book> {
  return invoke("set_book_cover", { vault, id, source });
}

export function deleteBook(vault: string, id: string): Promise<void> {
  return invoke("delete_book", { vault, id });
}
