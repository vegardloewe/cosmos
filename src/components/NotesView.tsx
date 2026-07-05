import { useEffect, useRef, useState } from "react";
import { ChevronRight, FileText, FolderPlus, PanelLeft, SquarePen } from "lucide-react";
import { useBoardStore } from "../stores/board-store";
import { MarkdownEditor } from "./MarkdownEditor";
import { readNote, writeNote } from "../lib/tauri-commands";
import type { NoteEntry } from "../types";

type DropZone = "before" | "after" | "into" | "root";

interface TreeProps {
  entries: NoteEntry[];
  depth: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, entry: NoteEntry) => void;
  renamingPath: string | null;
  renameValue: string;
  setRenameValue: (v: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  dropTarget: { path: string; zone: DropZone } | null;
  onRowDragStart: (e: React.DragEvent, entry: NoteEntry) => void;
  onRowDragOver: (e: React.DragEvent, entry: NoteEntry) => void;
  onRowDrop: (e: React.DragEvent) => void;
  onRowDragEnd: () => void;
}

function Tree(props: TreeProps) {
  const { entries, depth, expanded, onToggle, selectedPath, onSelect, onContextMenu } = props;

  return (
    <>
      {entries.map((entry) => {
        const isRenaming = props.renamingPath === entry.path;
        const row = isRenaming ? (
          <div key={entry.path} style={{ paddingLeft: 8 + depth * 14 }} className="py-0.5 pr-2">
            <input
              autoFocus
              value={props.renameValue}
              onChange={(e) => props.setRenameValue(e.target.value)}
              onBlur={props.onCommitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") props.onCommitRename();
                if (e.key === "Escape") props.onCancelRename();
              }}
              className="w-full px-1.5 py-1 bg-[#18191A] rounded-md text-[13px] text-text outline-none focus:ring-1 focus:ring-white/20"
            />
          </div>
        ) : (
          <button
            key={entry.path}
            draggable
            onDragStart={(e) => props.onRowDragStart(e, entry)}
            onDragOver={(e) => props.onRowDragOver(e, entry)}
            onDrop={props.onRowDrop}
            onDragEnd={props.onRowDragEnd}
            onClick={() => (entry.isDir ? onToggle(entry.path) : onSelect(entry.path))}
            onContextMenu={(e) => onContextMenu(e, entry)}
            style={{ paddingLeft: 8 + depth * 14 }}
            className={`w-full flex items-center gap-1.5 py-1.5 pr-2 rounded-md text-[13px] text-left transition-colors cursor-pointer ${
              !entry.isDir && selectedPath === entry.path
                ? "bg-[#18191A] text-white"
                : "text-[#A8B4C6] hover:text-text hover:bg-[#111213]"
            } ${
              props.dropTarget?.path === entry.path
                ? props.dropTarget.zone === "into"
                  ? "bg-[#16202E] ring-1 ring-inset ring-blue/60"
                  : props.dropTarget.zone === "before"
                    ? "shadow-[inset_0_2px_0_0_#3b82f6]"
                    : "shadow-[inset_0_-2px_0_0_#3b82f6]"
                : ""
            }`}
          >
            {entry.isDir ? (
              <ChevronRight
                size={13}
                className={`shrink-0 transition-transform duration-150 ${
                  expanded.has(entry.path) ? "rotate-90" : ""
                }`}
              />
            ) : (
              <span className="w-[13px] shrink-0" />
            )}
            <span className="flex-1 min-w-0 truncate">{entry.name}</span>
          </button>
        );

        return (
          <div key={entry.path}>
            {row}
            {entry.isDir && expanded.has(entry.path) && (
              <Tree {...props} entries={entry.children} depth={depth + 1} />
            )}
          </div>
        );
      })}
    </>
  );
}

export function NotesView() {
  const appMode = useBoardStore((s) => s.appMode);
  const vaultPath = useBoardStore((s) => s.vaultPath);
  const noteTree = useBoardStore((s) => s.noteTree);
  const selectedNotePath = useBoardStore((s) => s.selectedNotePath);
  const loadNoteTree = useBoardStore((s) => s.loadNoteTree);
  const selectNote = useBoardStore((s) => s.selectNote);
  const createNote = useBoardStore((s) => s.createNote);
  const createNoteFolder = useBoardStore((s) => s.createNoteFolder);
  const renameNotePath = useBoardStore((s) => s.renameNotePath);
  const deleteNotePath = useBoardStore((s) => s.deleteNotePath);
  const reorderNotes = useBoardStore((s) => s.reorderNotes);
  const moveNote = useBoardStore((s) => s.moveNote);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<{ x: number; y: number; entry: NoteEntry } | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [content, setContent] = useState<string | null>(null);
  const [titleValue, setTitleValue] = useState("");
  const [dragPath, setDragPath] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ path: string; zone: DropZone } | null>(null);
  const [sidebarHidden, setSidebarHidden] = useState(
    localStorage.getItem("cosmos-notes-sidebar") === "hidden",
  );

  const toggleSidebar = () => {
    setSidebarHidden((hidden) => {
      localStorage.setItem("cosmos-notes-sidebar", hidden ? "shown" : "hidden");
      return !hidden;
    });
  };
  const menuRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<number | null>(null);
  const pendingSave = useRef<{ path: string; content: string } | null>(null);

  const noteName = selectedNotePath
    ? selectedNotePath.split("/").pop()!.replace(/\.md$/i, "")
    : "";

  useEffect(() => {
    if (appMode === "notes") loadNoteTree();
  }, [appMode, loadNoteTree]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    };
    if (menu) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menu]);

  // Unsaved edits are flushed at the latest after a short pause in typing
  const flushSave = () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const pending = pendingSave.current;
    if (pending && vaultPath) {
      pendingSave.current = null;
      writeNote(vaultPath, pending.path, pending.content).catch(console.error);
    }
  };

  const handleContentChange = (md: string) => {
    setContent(md);
    if (!selectedNotePath) return;
    pendingSave.current = { path: selectedNotePath, content: md };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(flushSave, 800);
  };

  // Load the selected note (saving whatever was pending for the previous one)
  useEffect(() => {
    flushSave();
    setContent(null);
    setTitleValue(noteName);
    if (!selectedNotePath || !vaultPath) return;
    let cancelled = false;
    readNote(vaultPath, selectedNotePath)
      .then((c) => {
        if (!cancelled) setContent(c);
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNotePath, vaultPath]);

  // Keep the selected note visible: expand all its ancestor folders
  useEffect(() => {
    if (!selectedNotePath) return;
    const parts = selectedNotePath.split("/").slice(0, -1);
    if (parts.length === 0) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      let acc = "";
      for (const part of parts) {
        acc = acc ? `${acc}/${part}` : part;
        next.add(acc);
      }
      return next;
    });
  }, [selectedNotePath]);

  const toggleFolder = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  /* ── Drag & drop: reorder rows and move into folders ── */

  const parentOf = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
  const nameOf = (p: string) => p.split("/").pop()!;

  const childrenOf = (dir: string): NoteEntry[] => {
    if (!dir) return noteTree;
    const find = (entries: NoteEntry[]): NoteEntry | undefined => {
      for (const e of entries) {
        if (e.path === dir) return e;
        const hit = find(e.children);
        if (hit) return hit;
      }
      return undefined;
    };
    return find(noteTree)?.children ?? [];
  };

  const handleRowDragOver = (e: React.DragEvent, entry: NoteEntry) => {
    if (!dragPath || entry.path === dragPath) return;
    e.preventDefault();
    e.stopPropagation();
    // A folder can't land inside its own subtree
    if (entry.path.startsWith(dragPath + "/")) {
      setDropTarget(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / rect.height;
    // Folder rows: edges reorder, the middle drops into the folder
    const zone: DropZone = entry.isDir
      ? ratio < 0.25
        ? "before"
        : ratio > 0.75
          ? "after"
          : "into"
      : ratio < 0.5
        ? "before"
        : "after";
    setDropTarget({ path: entry.path, zone });
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const src = dragPath;
    const target = dropTarget;
    setDragPath(null);
    setDropTarget(null);
    if (!src || !target) return;

    if (target.zone === "into" || target.zone === "root") {
      const dir = target.zone === "root" ? "" : target.path;
      if (dir === parentOf(src)) {
        // Same folder: just move it to the end
        const names = childrenOf(dir)
          .map((c) => nameOf(c.path))
          .filter((n) => n !== nameOf(src));
        names.push(nameOf(src));
        await reorderNotes(dir, names);
      } else {
        await moveNote(src, dir, null);
        if (dir) setExpanded((prev) => new Set(prev).add(dir));
      }
      return;
    }

    // before/after a sibling row: build the target folder's new order
    const dir = parentOf(target.path);
    const names = childrenOf(dir)
      .map((c) => nameOf(c.path))
      .filter((n) => !(dir === parentOf(src) && n === nameOf(src)));
    let index = names.indexOf(nameOf(target.path));
    if (index === -1) return;
    if (target.zone === "after") index++;
    names.splice(index, 0, nameOf(src));

    if (dir === parentOf(src)) {
      await reorderNotes(dir, names);
    } else {
      await moveNote(src, dir, names);
    }
  };

  const startRename = (entry: NoteEntry) => {
    setRenamingPath(entry.path);
    setRenameValue(entry.name);
    setMenu(null);
  };

  const commitRename = () => {
    if (renamingPath && renameValue.trim()) {
      renameNotePath(renamingPath, renameValue.trim());
    }
    setRenamingPath(null);
    setRenameValue("");
  };

  const commitTitle = () => {
    const next = titleValue.trim();
    if (selectedNotePath && next && next !== noteName) {
      renameNotePath(selectedNotePath, next);
    } else {
      setTitleValue(noteName);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex">
      {/* Sidebar: folder tree */}
      <div
        className={`w-60 shrink-0 border-r border-border flex-col ${
          sidebarHidden ? "hidden" : "flex"
        }`}
      >
        <div className="flex items-center gap-1 px-3 py-2 shrink-0">
          <button
            onClick={() => createNote("")}
            title="New note"
            className="p-1.5 rounded-md text-[#A8B4C6] hover:text-text hover:bg-surface transition-colors cursor-pointer"
          >
            <SquarePen size={15} />
          </button>
          <button
            onClick={() => createNoteFolder("")}
            title="New folder"
            className="p-1.5 rounded-md text-[#A8B4C6] hover:text-text hover:bg-surface transition-colors cursor-pointer"
          >
            <FolderPlus size={15} />
          </button>
          <button
            onClick={toggleSidebar}
            title="Hide sidebar"
            className="ml-auto p-1.5 rounded-md text-[#A8B4C6] hover:text-text hover:bg-surface transition-colors cursor-pointer"
          >
            <PanelLeft size={15} />
          </button>
        </div>

        <div
          className={`flex-1 min-h-0 overflow-y-auto px-2 pb-4 ${
            dropTarget?.zone === "root" ? "ring-1 ring-inset ring-blue/40 rounded-md" : ""
          }`}
          onDragOver={(e) => {
            if (!dragPath) return;
            e.preventDefault();
            setDropTarget({ path: "", zone: "root" });
          }}
          onDrop={handleDrop}
        >
          {noteTree.length === 0 ? (
            <p className="px-2 py-2 text-xs text-text-muted">
              No notes yet — create one with the buttons above
            </p>
          ) : (
            <Tree
              entries={noteTree}
              depth={0}
              expanded={expanded}
              onToggle={toggleFolder}
              selectedPath={selectedNotePath}
              onSelect={selectNote}
              onContextMenu={(e, entry) => {
                e.preventDefault();
                setMenu({ x: e.clientX, y: e.clientY, entry });
              }}
              renamingPath={renamingPath}
              renameValue={renameValue}
              setRenameValue={setRenameValue}
              onCommitRename={commitRename}
              onCancelRename={() => {
                setRenamingPath(null);
                setRenameValue("");
              }}
              dropTarget={dropTarget}
              onRowDragStart={(e, entry) => {
                setDragPath(entry.path);
                e.dataTransfer.effectAllowed = "move";
              }}
              onRowDragOver={handleRowDragOver}
              onRowDrop={handleDrop}
              onRowDragEnd={() => {
                setDragPath(null);
                setDropTarget(null);
              }}
            />
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-w-0 overflow-y-auto relative">
        {sidebarHidden && (
          <button
            onClick={toggleSidebar}
            title="Show sidebar"
            className="absolute top-2 left-3 z-10 p-1.5 rounded-md text-[#A8B4C6] hover:text-text hover:bg-surface transition-colors cursor-pointer"
          >
            <PanelLeft size={15} />
          </button>
        )}
        {selectedNotePath && content !== null ? (
          <div className="max-w-2xl mx-auto px-10 py-12 flex flex-col gap-4">
            <input
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              placeholder="Untitled"
              className="w-full bg-transparent text-[28px] font-bold tracking-tight text-text placeholder:text-text-muted outline-none"
            />
            <MarkdownEditor
              value={content}
              onChange={handleContentChange}
              onBlur={flushSave}
              placeholder="Start writing..."
              rows={16}
              className="text-[15px] text-[#C6CCD6] leading-relaxed"
            />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center">
              <FileText size={48} strokeWidth={1} className="text-border" />
              <p className="text-sm text-text-muted">
                {selectedNotePath ? "Loading..." : "Select or create a note"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Context menu */}
      {menu && (
        <div
          ref={menuRef}
          className="fixed z-[200] w-44 bg-[#0F1010] border border-border rounded-xl shadow-2xl overflow-hidden py-1"
          style={{ left: menu.x, top: menu.y }}
        >
          {menu.entry.isDir && (
            <>
              <button
                onClick={() => {
                  createNote(menu.entry.path);
                  setMenu(null);
                }}
                className="w-full px-4 py-2 text-[13px] text-[#A8B4C6] hover:bg-[#18191A] transition-colors cursor-pointer text-left"
              >
                New note
              </button>
              <button
                onClick={() => {
                  createNoteFolder(menu.entry.path);
                  setExpanded((prev) => new Set(prev).add(menu.entry.path));
                  setMenu(null);
                }}
                className="w-full px-4 py-2 text-[13px] text-[#A8B4C6] hover:bg-[#18191A] transition-colors cursor-pointer text-left"
              >
                New folder
              </button>
            </>
          )}
          <button
            onClick={() => startRename(menu.entry)}
            className="w-full px-4 py-2 text-[13px] text-[#A8B4C6] hover:bg-[#18191A] transition-colors cursor-pointer text-left"
          >
            Rename
          </button>
          <button
            onClick={() => {
              deleteNotePath(menu.entry.path);
              setMenu(null);
            }}
            className="w-full px-4 py-2 text-[13px] text-red-400 hover:bg-[#18191A] transition-colors cursor-pointer text-left"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
