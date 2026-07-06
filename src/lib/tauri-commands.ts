import { invoke } from "@tauri-apps/api/core";
import type { Book, BookSearchResult, BookStatus, BoardItem, Collection, Goal, NoteEntry, Task, TaskEffort, TaskPriority, TaskProject, TaskStatus, VaultIndex } from "../types";

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

export function reorderBooks(vault: string, ids: string[]): Promise<void> {
  return invoke("reorder_books", { vault, ids });
}

export function setBookCover(vault: string, id: string, source: string): Promise<Book> {
  return invoke("set_book_cover", { vault, id, source });
}

export function deleteBook(vault: string, id: string): Promise<void> {
  return invoke("delete_book", { vault, id });
}

export function addGoal(
  vault: string,
  title: string,
  category: string,
  year: number,
  progressCurrent: number | null,
  progressTarget: number | null,
): Promise<Goal> {
  return invoke("add_goal", { vault, title, category, year, progressCurrent, progressTarget });
}

export function updateGoal(vault: string, goal: Goal): Promise<void> {
  return invoke("update_goal", { vault, goal });
}

export function deleteGoal(vault: string, id: string): Promise<void> {
  return invoke("delete_goal", { vault, id });
}

export function addTaskProject(vault: string, name: string, color: string): Promise<TaskProject> {
  return invoke("add_task_project", { vault, name, color });
}

export function deleteTaskProject(vault: string, id: string): Promise<void> {
  return invoke("delete_task_project", { vault, id });
}

export function addTask(
  vault: string,
  projectId: string,
  title: string,
  description: string | null,
  status: TaskStatus,
  priority: TaskPriority | null,
  effort: TaskEffort | null,
  deadline: string | null,
): Promise<Task> {
  return invoke("add_task", { vault, projectId, title, description, status, priority, effort, deadline });
}

export function updateTask(vault: string, task: Task): Promise<void> {
  return invoke("update_task", { vault, task });
}

export function deleteTask(vault: string, id: string): Promise<void> {
  return invoke("delete_task", { vault, id });
}

export function reorderTasks(vault: string, ids: string[]): Promise<void> {
  return invoke("reorder_tasks", { vault, ids });
}

export function listNotes(vault: string): Promise<NoteEntry[]> {
  return invoke("list_notes", { vault });
}

export function readNote(vault: string, path: string): Promise<string> {
  return invoke("read_note", { vault, path });
}

export function writeNote(vault: string, path: string, content: string): Promise<void> {
  return invoke("write_note", { vault, path, content });
}

export function createNote(vault: string, dir: string): Promise<string> {
  return invoke("create_note", { vault, dir });
}

export function createNoteWith(vault: string, dir: string, name: string, content: string): Promise<string> {
  return invoke("create_note_with", { vault, dir, name, content });
}

export function createNoteFolder(vault: string, dir: string): Promise<string> {
  return invoke("create_note_folder", { vault, dir });
}

export function renameNotePath(vault: string, path: string, newName: string): Promise<string> {
  return invoke("rename_note_path", { vault, path, newName });
}

export function deleteNotePath(vault: string, path: string): Promise<void> {
  return invoke("delete_note_path", { vault, path });
}

export function setNoteOrder(vault: string, dir: string, names: string[]): Promise<void> {
  return invoke("set_note_order", { vault, dir, names });
}

export function moveNotePath(vault: string, path: string, targetDir: string): Promise<string> {
  return invoke("move_note_path", { vault, path, targetDir });
}
