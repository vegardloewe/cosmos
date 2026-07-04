import { create } from "zustand";
import type { BoardItem, Book, BookStatus, Collection, Goal, ItemType, Task, TaskEffort, TaskPriority, TaskProject, TaskStatus } from "../types";
import * as commands from "../lib/tauri-commands";

export type AppMode = "moodboard" | "books" | "goals" | "tasks";
export type BooksTab = "library" | "want";

interface BoardState {
  vaultPath: string | null;
  items: BoardItem[];
  collections: Collection[];
  books: Book[];
  goals: Goal[];
  taskProjects: TaskProject[];
  tasks: Task[];
  activeProjectId: string | null;
  appMode: AppMode;
  booksTab: BooksTab;
  searchQuery: string;
  filterType: ItemType | null;
  filterCollectionId: string | null;
  isLoading: boolean;
  selectedItemId: string | null;
  pendingItemId: string | null;
  enrichingItemIds: Set<string>;

  loadVault: () => Promise<void>;
  createNewVault: (path: string) => Promise<void>;
  openExistingVault: (path: string) => Promise<void>;
  addImage: (sourcePath: string) => Promise<void>;
  addImageData: (data: number[], ext: string) => Promise<void>;
  addVideo: (sourcePath: string) => Promise<void>;
  addVideoData: (data: number[], ext: string) => Promise<void>;
  addLink: (url: string) => Promise<void>;
  addNote: (title: string, content: string) => Promise<void>;
  addCapturedItem: (item: BoardItem) => void;
  applyEnrichedItem: (item: BoardItem) => void;
  removeItem: (id: string) => Promise<void>;
  updateItemTags: (id: string, tags: string[]) => Promise<void>;
  updateItemField: (id: string, field: Partial<BoardItem>) => Promise<void>;
  addCollection: (name: string, color: string) => Promise<void>;
  removeCollection: (id: string) => Promise<void>;
  renameCollection: (id: string, name: string) => Promise<void>;
  updateItemCollections: (id: string, collectionIds: string[]) => Promise<void>;
  autoTagItem: (id: string) => Promise<void>;
  addBook: (title: string, author: string | null, coverUrl: string | null, status: BookStatus, yearRead: number | null) => Promise<void>;
  updateBook: (id: string, changes: Partial<Book>) => Promise<void>;
  setBookCover: (id: string, sourcePath: string) => Promise<void>;
  removeBook: (id: string) => Promise<void>;
  moveBook: (draggedId: string, overId: string) => void;
  persistBookOrder: () => Promise<void>;
  addGoal: (title: string, category: string, progressCurrent: number | null, progressTarget: number | null) => Promise<void>;
  updateGoal: (id: string, changes: Partial<Goal>) => Promise<void>;
  removeGoal: (id: string) => Promise<void>;
  addTaskProject: (name: string, color: string) => Promise<void>;
  removeTaskProject: (id: string) => Promise<void>;
  setActiveProject: (id: string | null) => void;
  addTask: (title: string, description: string | null, status: TaskStatus, priority: TaskPriority | null, effort: TaskEffort | null) => Promise<void>;
  updateTask: (id: string, changes: Partial<Task>) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  moveTask: (draggedId: string, overId: string) => void;
  moveTaskToStatus: (draggedId: string, status: TaskStatus) => void;
  persistTaskDrag: (draggedId: string) => Promise<void>;
  setAppMode: (mode: AppMode) => void;
  setBooksTab: (tab: BooksTab) => void;
  setSearchQuery: (query: string) => void;
  setFilterType: (type: ItemType | null) => void;
  setFilterCollection: (id: string | null) => void;
  selectItem: (id: string | null) => void;
}

export const useBoardStore = create<BoardState>((set, get) => ({
  vaultPath: null,
  items: [],
  collections: [],
  books: [],
  goals: [],
  taskProjects: [],
  tasks: [],
  activeProjectId: localStorage.getItem("cosmos-task-project"),
  appMode: (localStorage.getItem("cosmos-mode") as AppMode) || "moodboard",
  booksTab: "library",
  searchQuery: "",
  filterType: null,
  filterCollectionId: null,
  isLoading: true,
  selectedItemId: null,
  pendingItemId: null,
  enrichingItemIds: new Set<string>(),

  loadVault: async () => {
    set({ isLoading: true });
    try {
      const path = await commands.getVaultPath();
      if (path) {
        const index = await commands.openVault(path);
        const taskProjects = index.taskProjects || [];
        const saved = get().activeProjectId;
        set({
          vaultPath: path,
          items: index.items,
          collections: index.collections || [],
          books: index.books || [],
          goals: index.goals || [],
          taskProjects,
          tasks: index.tasks || [],
          activeProjectId: taskProjects.some((p) => p.id === saved)
            ? saved
            : taskProjects[0]?.id ?? null,
        });
      }
    } catch (e) {
      console.error("Failed to load vault:", e);
    } finally {
      set({ isLoading: false });
    }
  },

  createNewVault: async (path: string) => {
    await commands.createVault(path);
    await commands.setVaultPath(path);
    set({ vaultPath: path, items: [], collections: [], books: [], goals: [], taskProjects: [], tasks: [], activeProjectId: null });
  },

  openExistingVault: async (path: string) => {
    const index = await commands.openVault(path);
    await commands.setVaultPath(path);
    const taskProjects = index.taskProjects || [];
    set({
      vaultPath: path,
      items: index.items,
      collections: index.collections || [],
      books: index.books || [],
      goals: index.goals || [],
      taskProjects,
      tasks: index.tasks || [],
      activeProjectId: taskProjects[0]?.id ?? null,
    });
  },

  addImage: async (sourcePath: string) => {
    const { vaultPath } = get();
    if (!vaultPath) return;
    const placeholderId = `pending-${Date.now()}`;
    const placeholder: BoardItem = {
      id: placeholderId, type: "image", createdAt: String(Date.now()),
      updatedAt: String(Date.now()), tags: [], collectionIds: [],
      title: sourcePath.split("/").pop() || "Importing...",
    };
    set((s) => ({ items: [placeholder, ...s.items], pendingItemId: placeholderId }));
    const item = await commands.importImage(vaultPath, sourcePath);
    set((s) => ({
      items: s.items.map((i) => i.id === placeholderId ? item : i),
      pendingItemId: s.pendingItemId === placeholderId ? null : s.pendingItemId,
    }));
    get().autoTagItem(item.id);
  },

  addImageData: async (data: number[], ext: string) => {
    const { vaultPath } = get();
    if (!vaultPath) return;
    const placeholderId = `pending-${Date.now()}`;
    const placeholder: BoardItem = {
      id: placeholderId, type: "image", createdAt: String(Date.now()),
      updatedAt: String(Date.now()), tags: [], collectionIds: [],
      title: "Pasting image...",
    };
    set((s) => ({ items: [placeholder, ...s.items], pendingItemId: placeholderId }));
    const item = await commands.importImageData(vaultPath, data, ext);
    set((s) => ({
      items: s.items.map((i) => i.id === placeholderId ? item : i),
      pendingItemId: s.pendingItemId === placeholderId ? null : s.pendingItemId,
    }));
    get().autoTagItem(item.id);
  },

  addVideo: async (sourcePath: string) => {
    const { vaultPath } = get();
    if (!vaultPath) return;
    const placeholderId = `pending-${Date.now()}`;
    const placeholder: BoardItem = {
      id: placeholderId, type: "video", createdAt: String(Date.now()),
      updatedAt: String(Date.now()), tags: [], collectionIds: [],
      title: sourcePath.split("/").pop() || "Importing...",
    };
    set((s) => ({ items: [placeholder, ...s.items], pendingItemId: placeholderId }));
    const item = await commands.importVideo(vaultPath, sourcePath);
    set((s) => ({
      items: s.items.map((i) => i.id === placeholderId ? item : i),
      pendingItemId: s.pendingItemId === placeholderId ? null : s.pendingItemId,
    }));
    get().autoTagItem(item.id);
  },

  addVideoData: async (data: number[], ext: string) => {
    const { vaultPath } = get();
    if (!vaultPath) return;
    const placeholderId = `pending-${Date.now()}`;
    const placeholder: BoardItem = {
      id: placeholderId, type: "video", createdAt: String(Date.now()),
      updatedAt: String(Date.now()), tags: [], collectionIds: [],
      title: "Pasting video...",
    };
    set((s) => ({ items: [placeholder, ...s.items], pendingItemId: placeholderId }));
    const item = await commands.importVideoData(vaultPath, data, ext);
    set((s) => ({
      items: s.items.map((i) => i.id === placeholderId ? item : i),
      pendingItemId: s.pendingItemId === placeholderId ? null : s.pendingItemId,
    }));
    get().autoTagItem(item.id);
  },

  addLink: async (url: string) => {
    const { vaultPath } = get();
    if (!vaultPath) return;
    const placeholderId = `pending-${Date.now()}`;
    const placeholder: BoardItem = {
      id: placeholderId, type: "link", createdAt: String(Date.now()),
      updatedAt: String(Date.now()), tags: [], collectionIds: [],
      url, linkTitle: url,
    };
    set((s) => ({ items: [placeholder, ...s.items], pendingItemId: placeholderId }));
    const item = await commands.importLink(vaultPath, url);
    set((s) => ({
      items: s.items.map((i) => i.id === placeholderId ? item : i),
      pendingItemId: s.pendingItemId === placeholderId ? null : s.pendingItemId,
    }));
    get().autoTagItem(item.id);
  },

  addNote: async (title: string, content: string) => {
    const { vaultPath } = get();
    if (!vaultPath) return;
    const placeholderId = `pending-${Date.now()}`;
    const placeholder: BoardItem = {
      id: placeholderId, type: "text", createdAt: String(Date.now()),
      updatedAt: String(Date.now()), tags: [], collectionIds: [],
      title, excerpt: content,
    };
    set((s) => ({ items: [placeholder, ...s.items], pendingItemId: placeholderId }));
    const item = await commands.addNote(vaultPath, title, content);
    set((s) => ({
      items: s.items.map((i) => i.id === placeholderId ? item : i),
      pendingItemId: s.pendingItemId === placeholderId ? null : s.pendingItemId,
    }));
    get().autoTagItem(item.id);
  },

  // Item already written to the vault by the global capture hotkey (Rust side).
  // Arrives bare (just the URL); metadata and AI tags follow via applyEnrichedItem.
  addCapturedItem: (item: BoardItem) => {
    set((s) => ({ items: [item, ...s.items] }));
  },

  applyEnrichedItem: (item: BoardItem) => {
    set((s) => ({
      items: s.items.map((i) => (i.id === item.id ? { ...i, ...item } : i)),
    }));
    get().autoTagItem(item.id);
  },

  removeItem: async (id: string) => {
    const { vaultPath } = get();
    if (!vaultPath) return;
    await commands.deleteItem(vaultPath, id);
    set((s) => ({
      items: s.items.filter((i) => i.id !== id),
      selectedItemId: s.selectedItemId === id ? null : s.selectedItemId,
    }));
  },

  updateItemTags: async (id: string, tags: string[]) => {
    const { vaultPath, items } = get();
    if (!vaultPath) return;
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const updated = { ...item, tags };
    await commands.updateItem(vaultPath, updated);
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? updated : i)),
    }));
  },

  updateItemField: async (id: string, field: Partial<BoardItem>) => {
    const { vaultPath, items } = get();
    if (!vaultPath) return;
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const updated = { ...item, ...field };
    await commands.updateItem(vaultPath, updated);
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? updated : i)),
    }));
  },

  addCollection: async (name: string, color: string) => {
    const { vaultPath } = get();
    if (!vaultPath) return;
    const collection = await commands.createCollection(vaultPath, name, color);
    set((s) => ({ collections: [...s.collections, collection] }));
  },

  removeCollection: async (id: string) => {
    const { vaultPath } = get();
    if (!vaultPath) return;
    await commands.deleteCollection(vaultPath, id);
    set((s) => ({
      collections: s.collections.filter((c) => c.id !== id),
      filterCollectionId: s.filterCollectionId === id ? null : s.filterCollectionId,
      items: s.items.map((item) => ({
        ...item,
        collectionIds: item.collectionIds.filter((cid) => cid !== id),
      })),
    }));
  },

  renameCollection: async (id: string, name: string) => {
    const { vaultPath } = get();
    if (!vaultPath) return;
    await commands.renameCollection(vaultPath, id, name);
    set((s) => ({
      collections: s.collections.map((c) =>
        c.id === id ? { ...c, name } : c,
      ),
    }));
  },

  updateItemCollections: async (id: string, collectionIds: string[]) => {
    const { vaultPath, items } = get();
    if (!vaultPath) return;
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const updated = { ...item, collectionIds };
    await commands.updateItem(vaultPath, updated);
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? updated : i)),
    }));
  },

  autoTagItem: async (id: string) => {
    const { vaultPath } = get();
    if (!vaultPath) return;
    // Mark item as enriching
    set((s) => ({ enrichingItemIds: new Set([...s.enrichingItemIds, id]) }));
    // Fire and forget — Rust spawns a thread, returns immediately
    await commands.autoTagItem(vaultPath, id);
    // Poll for enrichment results (background thread writes to index)
    const poll = async (attempts: number) => {
      if (attempts <= 0) {
        set((s) => {
          const next = new Set(s.enrichingItemIds);
          next.delete(id);
          return { enrichingItemIds: next };
        });
        return;
      }
      await new Promise((r) => setTimeout(r, 3000));
      const { vaultPath: v } = get();
      if (!v) return;
      try {
        const index = await commands.openVault(v);
        const updated = index.items.find((i: any) => i.id === id);
        if (updated && updated.tags && updated.tags.length > 0) {
          set((s) => {
            const next = new Set(s.enrichingItemIds);
            next.delete(id);
            return {
              items: s.items.map((i) =>
                i.id === id
                  ? { ...i, tags: updated.tags, title: updated.title, linkDescription: updated.linkDescription }
                  : i,
              ),
              enrichingItemIds: next,
            };
          });
        } else {
          poll(attempts - 1);
        }
      } catch {}
    };
    poll(5);
  },

  addBook: async (title, author, coverUrl, status, yearRead) => {
    const { vaultPath } = get();
    if (!vaultPath) return;
    const book = await commands.addBook(vaultPath, title, author, coverUrl, status, yearRead);
    set((s) => ({ books: [book, ...s.books] }));
  },

  updateBook: async (id, changes) => {
    const { vaultPath, books } = get();
    if (!vaultPath) return;
    const book = books.find((b) => b.id === id);
    if (!book) return;
    const updated = { ...book, ...changes };
    await commands.updateBook(vaultPath, updated);
    set((s) => ({
      books: s.books.map((b) => (b.id === id ? updated : b)),
    }));
  },

  setBookCover: async (id, sourcePath) => {
    const { vaultPath } = get();
    if (!vaultPath) return;
    const updated = await commands.setBookCover(vaultPath, id, sourcePath);
    set((s) => ({
      books: s.books.map((b) => (b.id === id ? updated : b)),
    }));
  },

  removeBook: async (id) => {
    const { vaultPath } = get();
    if (!vaultPath) return;
    await commands.deleteBook(vaultPath, id);
    set((s) => ({ books: s.books.filter((b) => b.id !== id) }));
  },

  // Local-only move while dragging; persistBookOrder saves on drop
  moveBook: (draggedId, overId) => {
    set((s) => {
      const from = s.books.findIndex((b) => b.id === draggedId);
      const to = s.books.findIndex((b) => b.id === overId);
      if (from === -1 || to === -1 || from === to) return {};
      const next = [...s.books];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { books: next };
    });
  },

  persistBookOrder: async () => {
    const { vaultPath, books } = get();
    if (!vaultPath) return;
    await commands.reorderBooks(vaultPath, books.map((b) => b.id));
  },

  addGoal: async (title, category, progressCurrent, progressTarget) => {
    const { vaultPath } = get();
    if (!vaultPath) return;
    const goal = await commands.addGoal(
      vaultPath,
      title,
      category,
      new Date().getFullYear(),
      progressCurrent,
      progressTarget,
    );
    set((s) => ({ goals: [...s.goals, goal] }));
  },

  updateGoal: async (id, changes) => {
    const { vaultPath, goals } = get();
    if (!vaultPath) return;
    const goal = goals.find((g) => g.id === id);
    if (!goal) return;
    const updated = { ...goal, ...changes };
    await commands.updateGoal(vaultPath, updated);
    set((s) => ({
      goals: s.goals.map((g) => (g.id === id ? updated : g)),
    }));
  },

  removeGoal: async (id) => {
    const { vaultPath } = get();
    if (!vaultPath) return;
    await commands.deleteGoal(vaultPath, id);
    set((s) => ({ goals: s.goals.filter((g) => g.id !== id) }));
  },

  addTaskProject: async (name, color) => {
    const { vaultPath } = get();
    if (!vaultPath) return;
    const project = await commands.addTaskProject(vaultPath, name, color);
    localStorage.setItem("cosmos-task-project", project.id);
    set((s) => ({
      taskProjects: [...s.taskProjects, project],
      activeProjectId: project.id,
    }));
  },

  removeTaskProject: async (id) => {
    const { vaultPath } = get();
    if (!vaultPath) return;
    await commands.deleteTaskProject(vaultPath, id);
    set((s) => {
      const taskProjects = s.taskProjects.filter((p) => p.id !== id);
      const activeProjectId =
        s.activeProjectId === id ? taskProjects[0]?.id ?? null : s.activeProjectId;
      if (activeProjectId) localStorage.setItem("cosmos-task-project", activeProjectId);
      else localStorage.removeItem("cosmos-task-project");
      return {
        taskProjects,
        tasks: s.tasks.filter((t) => t.projectId !== id),
        activeProjectId,
      };
    });
  },

  setActiveProject: (id) => {
    if (id) localStorage.setItem("cosmos-task-project", id);
    else localStorage.removeItem("cosmos-task-project");
    set({ activeProjectId: id });
  },

  addTask: async (title, description, status, priority, effort) => {
    const { vaultPath, activeProjectId } = get();
    if (!vaultPath || !activeProjectId) return;
    const task = await commands.addTask(
      vaultPath,
      activeProjectId,
      title,
      description,
      status,
      priority,
      effort,
    );
    set((s) => ({ tasks: [...s.tasks, task] }));
  },

  updateTask: async (id, changes) => {
    const { vaultPath, tasks } = get();
    if (!vaultPath) return;
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const updated = { ...task, ...changes };
    await commands.updateTask(vaultPath, updated);
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? updated : t)),
    }));
  },

  removeTask: async (id) => {
    const { vaultPath } = get();
    if (!vaultPath) return;
    await commands.deleteTask(vaultPath, id);
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
  },

  // Local-only move while dragging; persistTaskDrag saves on drop.
  // Dragging over a card adopts that card's column (kanban semantics).
  moveTask: (draggedId, overId) => {
    set((s) => {
      const from = s.tasks.findIndex((t) => t.id === draggedId);
      const to = s.tasks.findIndex((t) => t.id === overId);
      if (from === -1 || to === -1 || from === to) return {};
      const overStatus = s.tasks[to].status;
      const next = [...s.tasks];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, { ...moved, status: overStatus });
      return { tasks: next };
    });
  },

  moveTaskToStatus: (draggedId, status) => {
    set((s) => {
      const task = s.tasks.find((t) => t.id === draggedId);
      if (!task || task.status === status) return {};
      // Move to the end of the target column (end of array keeps column order stable)
      const rest = s.tasks.filter((t) => t.id !== draggedId);
      return { tasks: [...rest, { ...task, status }] };
    });
  },

  persistTaskDrag: async (draggedId) => {
    const { vaultPath, tasks } = get();
    if (!vaultPath) return;
    const dragged = tasks.find((t) => t.id === draggedId);
    // Status may have changed while dragging across columns
    if (dragged) await commands.updateTask(vaultPath, dragged);
    await commands.reorderTasks(vaultPath, tasks.map((t) => t.id));
  },

  setAppMode: (mode: AppMode) => {
    localStorage.setItem("cosmos-mode", mode);
    set({ appMode: mode });
  },
  setBooksTab: (tab: BooksTab) => set({ booksTab: tab }),
  setSearchQuery: (query: string) => set({ searchQuery: query }),
  setFilterType: (type: ItemType | null) => set({ filterType: type }),
  setFilterCollection: (id: string | null) => set({ filterCollectionId: id }),
  selectItem: (id: string | null) => set({ selectedItemId: id }),
}));

export function useFilteredItems(): BoardItem[] {
  const items = useBoardStore((s) => s.items);
  const searchQuery = useBoardStore((s) => s.searchQuery);
  const filterType = useBoardStore((s) => s.filterType);
  const filterCollectionId = useBoardStore((s) => s.filterCollectionId);

  return items.filter((item) => {
    if (filterType && item.type !== filterType) return false;
    if (filterCollectionId && !(item.collectionIds || []).includes(filterCollectionId)) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const searchable = [
      item.title,
      item.url,
      item.excerpt,
      item.linkTitle,
      item.linkDescription,
      ...item.tags,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return searchable.includes(q);
  }).sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
}
