import { useState, useEffect, useRef } from "react";
import { Plus, X } from "lucide-react";
import { useBoardStore } from "../stores/board-store";
import type { ItemType } from "../types";
import { AddModal } from "./AddModal";

const FILTER_OPTIONS: { label: string; value: ItemType | null }[] = [
  { label: "All", value: null },
  { label: "Images", value: "image" },
  { label: "Links", value: "link" },
  { label: "Notes", value: "text" },
];

export function Toolbar() {
  const appMode = useBoardStore((s) => s.appMode);
  const searchQuery = useBoardStore((s) => s.searchQuery);
  const setSearchQuery = useBoardStore((s) => s.setSearchQuery);
  const filterType = useBoardStore((s) => s.filterType);
  const setFilterType = useBoardStore((s) => s.setFilterType);
  const collections = useBoardStore((s) => s.collections);
  const filterCollectionId = useBoardStore((s) => s.filterCollectionId);
  const setFilterCollection = useBoardStore((s) => s.setFilterCollection);
  const removeCollection = useBoardStore((s) => s.removeCollection);
  const renameCollection = useBoardStore((s) => s.renameCollection);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showCollections, setShowCollections] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; collectionId: string } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const collectionsRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const selectedCollection = filterCollectionId
    ? collections.find((c) => c.id === filterCollectionId)
    : null;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (appMode !== "moodboard") return;
      if (e.metaKey && e.key === "f") {
        e.preventDefault();
        setShowSearch(true);
      }
      if (e.key === "Escape" && showSearch) {
        setShowSearch(false);
        setSearchQuery("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [appMode, showSearch, setSearchQuery]);

  useEffect(() => {
    if (showSearch) {
      searchInputRef.current?.focus();
    }
  }, [showSearch]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (collectionsRef.current && !collectionsRef.current.contains(e.target as Node)) {
        setShowCollections(false);
      }
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    if (showCollections || contextMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCollections, contextMenu]);

  const handleContextMenu = (e: React.MouseEvent, collectionId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, collectionId });
  };

  const handleStartRename = () => {
    if (!contextMenu) return;
    const col = collections.find((c) => c.id === contextMenu.collectionId);
    if (!col) return;
    setRenamingId(contextMenu.collectionId);
    setRenameValue(col.name);
    setContextMenu(null);
  };

  const handleRenameSubmit = () => {
    if (renamingId && renameValue.trim()) {
      renameCollection(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue("");
  };

  const handleDeleteCollection = () => {
    if (!contextMenu) return;
    removeCollection(contextMenu.collectionId);
    setContextMenu(null);
  };

  return (
    <>
      <div
        className={`flex-1 min-w-0 items-center gap-4 relative z-10 ${
          appMode === "moodboard" ? "flex" : "hidden"
        }`}
      >
        {/* Center: Search (Cmd+F to show, Escape to hide) */}
        {showSearch ? (
          <div className="flex-1 max-w-md mx-auto relative z-10">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" strokeLinecap="round" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full pl-10 pr-4 py-2 bg-surface rounded-lg text-[13px] text-text placeholder:text-text-muted outline-none focus:ring-2 focus:ring-white/20 transition-shadow"
            />
          </div>
        ) : (
          <div className="flex-1 relative z-10" />
        )}

        {/* Right: Collections + Filters + Add */}
        <div className="flex items-center gap-2 shrink-0 relative z-10">
          {/* Collections dropdown */}
          <div className="relative" ref={collectionsRef}>
            {selectedCollection ? (
              renamingId === selectedCollection.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={handleRenameSubmit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRenameSubmit();
                    if (e.key === "Escape") { setRenamingId(null); setRenameValue(""); }
                  }}
                  className="px-4 py-1.5 rounded-full text-[13px] font-medium bg-[#0F1010] text-white outline-none w-40"
                />
              ) : (
                <button
                  onClick={() => setFilterCollection(null)}
                  onContextMenu={(e) => handleContextMenu(e, selectedCollection.id)}
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[13px] font-medium bg-[#0F1010] text-white cursor-pointer transition-colors"
                >
                  <span
                    className="w-3 h-3 rounded-full border-2 shrink-0"
                    style={{ borderColor: selectedCollection.color }}
                  />
                  {selectedCollection.name}
                  <X size={14} className="text-[#A8B4C6]" />
                </button>
              )
            ) : (
              <button
                onClick={() => setShowCollections(!showCollections)}
                className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-colors cursor-pointer ${
                  showCollections
                    ? "bg-[#0F1010] text-white"
                    : "text-[#A8B4C6] hover:text-text hover:bg-[#0F1010]"
                }`}
              >
                Collections
              </button>
            )}

            {showCollections && !selectedCollection && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-[#0F1010] border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
                {collections.length > 0 ? (
                  <div className="py-1">
                    {collections.map((col) => (
                      renamingId === col.id ? (
                        <div key={col.id} className="px-4 py-2">
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={handleRenameSubmit}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRenameSubmit();
                              if (e.key === "Escape") { setRenamingId(null); setRenameValue(""); }
                            }}
                            className="w-full px-3 py-1.5 bg-[#18191A] rounded-lg text-sm text-text outline-none"
                          />
                        </div>
                      ) : (
                        <button
                          key={col.id}
                          onClick={() => {
                            setFilterCollection(col.id);
                            setShowCollections(false);
                          }}
                          onContextMenu={(e) => handleContextMenu(e, col.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#A8B4C6] hover:bg-[#18191A] transition-colors cursor-pointer"
                        >
                          <span
                            className="w-4 h-4 rounded-full border-2 shrink-0"
                            style={{ borderColor: col.color }}
                          />
                          {col.name}
                        </button>
                      )
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-3 text-sm text-[#5C626B]">
                    No collections yet
                  </div>
                )}
              </div>
            )}
          </div>

          <span className="text-[#2A2B2D] select-none">|</span>

          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => setFilterType(opt.value)}
              className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-colors cursor-pointer ${
                filterType === opt.value
                  ? "bg-[#0F1010] text-white"
                  : "text-[#A8B4C6] hover:text-text hover:bg-[#0F1010]"
              }`}
            >
              {opt.label}
            </button>
          ))}
          <button
            onClick={() => setShowAddModal(true)}
            className="ml-2 p-1.5 bg-transparent text-[#A8B4C6] rounded-full hover:text-text hover:bg-[#0F1010] transition-colors cursor-pointer"
          >
            <Plus size={18} strokeWidth={2} />
          </button>
        </div>
      </div>

      {showAddModal && <AddModal onClose={() => setShowAddModal(false)} />}

      {/* Context menu for collections */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-[200] w-40 bg-[#0F1010] border border-border rounded-xl shadow-2xl overflow-hidden"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={handleStartRename}
            className="w-full px-4 py-2.5 text-sm text-[#A8B4C6] hover:bg-[#18191A] transition-colors cursor-pointer text-left"
          >
            Rename
          </button>
          <button
            onClick={handleDeleteCollection}
            className="w-full px-4 py-2.5 text-sm text-red-400 hover:bg-[#18191A] transition-colors cursor-pointer text-left"
          >
            Delete
          </button>
        </div>
      )}
    </>
  );
}
