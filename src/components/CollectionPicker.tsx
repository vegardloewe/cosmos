import { useState, useRef, useEffect } from "react";
import { PlusIcon } from "lucide-react";
import { useBoardStore } from "../stores/board-store";

const COLLECTION_COLORS = [
  "#FFE926", // yellow
  "#5B8AF5", // blue
  "#A8A8A8", // gray
  "#E85454", // red
  "#E88C4A", // orange
  "#B87AE8", // purple
  "#5CB13E", // green
  "#FF7DD3", // pink
];

interface CollectionPillProps {
  name: string;
  color: string;
  onRemove?: () => void;
}

function CollectionPill({ name, color, onRemove }: CollectionPillProps) {
  return (
    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium bg-[#18191A] text-[#A8B4C6]">
      <span
        className="w-3 h-3 rounded-full border-2 shrink-0"
        style={{ borderColor: color }}
      />
      {name}
      {onRemove && (
        <button onClick={onRemove} className="hover:opacity-70 cursor-pointer">
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </span>
  );
}

interface CollectionPickerProps {
  itemId: string;
  collectionIds: string[];
}

export function CollectionPicker({
  itemId,
  collectionIds,
}: CollectionPickerProps) {
  const collections = useBoardStore((s) => s.collections);
  const addCollection = useBoardStore((s) => s.addCollection);
  const updateItemCollections = useBoardStore((s) => s.updateItemCollections);

  const [showDropdown, setShowDropdown] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLLECTION_COLORS[0]);
  const [isCreating, setIsCreating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
        setIsCreating(false);
        setNewName("");
      }
    };
    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDropdown]);

  const itemCollections = collections.filter((c) =>
    collectionIds.includes(c.id),
  );
  const availableCollections = collections.filter(
    (c) => !collectionIds.includes(c.id),
  );

  const toggleCollection = (collectionId: string) => {
    if (collectionIds.includes(collectionId)) {
      updateItemCollections(
        itemId,
        collectionIds.filter((id) => id !== collectionId),
      );
    } else {
      updateItemCollections(itemId, [...collectionIds, collectionId]);
    }
  };

  const handleCreateCollection = async () => {
    const name = newName.trim();
    if (!name) return;
    await addCollection(name, selectedColor);
    setNewName("");
    setIsCreating(false);
    // The new collection will appear in the list, user can then select it
  };

  return (
    <div>
      <label className="text-xs font-medium text-[#5C626B] uppercase tracking-wide mb-1.5 block">
        Collections
      </label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="inline-flex items-center px-4 py-2 gap-2 bg-[#18191A] text-[#5C626B] text-xs font-medium rounded-full hover:text-text transition-colors cursor-pointer"
          >
            <PlusIcon size={14} /> Add
          </button>

          {showDropdown && (
            <div className="absolute left-0 top-full mt-2 w-64 bg-[#0F1010] border border-border rounded-xl shadow-md z-50 overflow-hidden">
              {/* Existing collections */}
              {availableCollections.length > 0 && (
                <div className="py-1">
                  {availableCollections.map((col) => (
                    <button
                      key={col.id}
                      onClick={() => {
                        toggleCollection(col.id);
                        setShowDropdown(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#A8B4C6] hover:bg-[#18191A] transition-colors cursor-pointer"
                    >
                      <span
                        className="w-4 h-4 rounded-full border-2 shrink-0"
                        style={{ borderColor: col.color }}
                      />
                      {col.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Divider */}
              {availableCollections.length > 0 && (
                <div className="border-t border-border" />
              )}

              {/* Create new */}
              {isCreating ? (
                <div className="p-3 flex flex-col gap-3">
                  <input
                    ref={inputRef}
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateCollection();
                      if (e.key === "Escape") {
                        setIsCreating(false);
                        setNewName("");
                      }
                    }}
                    placeholder="Collection name..."
                    className="w-full px-3 py-2 bg-[#18191A] rounded-lg text-sm text-text placeholder:text-text-muted outline-none"
                  />
                  <div className="flex gap-1.5">
                    {COLLECTION_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setSelectedColor(color)}
                        className={`w-6 h-6 rounded-full border-2 cursor-pointer transition-transform ${
                          selectedColor === color
                            ? "scale-125"
                            : "opacity-60 hover:opacity-100"
                        }`}
                        style={{ borderColor: color }}
                      />
                    ))}
                  </div>
                  <button
                    onClick={handleCreateCollection}
                    disabled={!newName.trim()}
                    className="w-full py-2 bg-white text-bg text-xs font-semibold rounded-lg hover:bg-white/90 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Create
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsCreating(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-[#18191A] transition-colors cursor-pointer"
                  style={{ color: "#FFFFFF" }}
                >
                  <PlusIcon size={16} />
                  Create new space
                </button>
              )}
            </div>
          )}
        </div>
        {itemCollections.map((col) => (
          <CollectionPill
            key={col.id}
            name={col.name}
            color={col.color}
            onRemove={() => toggleCollection(col.id)}
          />
        ))}
      </div>
    </div>
  );
}
