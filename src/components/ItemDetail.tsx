import { useState, useEffect } from "react";
import { useBoardStore, useFilteredItems } from "../stores/board-store";
import { readAsset, readAssetBytes } from "../lib/tauri-commands";
import { openUrl } from "@tauri-apps/plugin-opener";
import { TagPill } from "./TagPill";
import { CollectionPicker } from "./CollectionPicker";
import { PlusIcon } from "lucide-react";

function formatDate(millis: string): string {
  const date = new Date(Number(millis));
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function typeLabel(type: string): string {
  switch (type) {
    case "image":
      return "Image";
    case "link":
      return "Link";
    case "text":
      return "Note";
    default:
      return type;
  }
}

export function ItemDetail() {
  const selectedItemId = useBoardStore((s) => s.selectedItemId);
  const items = useBoardStore((s) => s.items);
  const vaultPath = useBoardStore((s) => s.vaultPath);
  const selectItem = useBoardStore((s) => s.selectItem);
  const removeItem = useBoardStore((s) => s.removeItem);
  const updateItemField = useBoardStore((s) => s.updateItemField);
  const updateItemTags = useBoardStore((s) => s.updateItemTags);
  const pendingItemId = useBoardStore((s) => s.pendingItemId);
  const enrichingItemIds = useBoardStore((s) => s.enrichingItemIds);

  const filteredItems = useFilteredItems();
  const item = items.find((i) => i.id === selectedItemId);
  const isPending = selectedItemId === pendingItemId;
  const isEnriching = selectedItemId ? enrichingItemIds.has(selectedItemId) : false;

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [editingExcerpt, setEditingExcerpt] = useState(false);
  const [excerptValue, setExcerptValue] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedItemId || editingTitle || editingUrl || editingExcerpt)
        return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      const currentIndex = filteredItems.findIndex(
        (i) => i.id === selectedItemId,
      );
      if (currentIndex === -1) return;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = filteredItems[currentIndex + 1];
        if (next) selectItem(next.id);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = filteredItems[currentIndex - 1];
        if (prev) selectItem(prev.id);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedItemId,
    filteredItems,
    selectItem,
    editingTitle,
    editingUrl,
    editingExcerpt,
  ]);

  useEffect(() => {
    setImageSrc(null);
    setVideoSrc(null);
    if (!item || !vaultPath) return;

    if (item.type === "video" && item.assetPath) {
      let cancelled = false;
      let blobUrl: string | null = null;
      const mimeMap: Record<string, string> = {
        mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
        mkv: "video/x-matroska", avi: "video/x-msvideo",
      };
      readAssetBytes(vaultPath, item.assetPath).then((buffer) => {
        if (cancelled) return;
        const ext = item.assetPath?.split(".").pop()?.toLowerCase() || "mp4";
        const blob = new Blob([buffer], { type: mimeMap[ext] || "video/mp4" });
        blobUrl = URL.createObjectURL(blob);
        setVideoSrc(blobUrl);
      }).catch(console.error);
      return () => { cancelled = true; if (blobUrl) URL.revokeObjectURL(blobUrl); };
    } else {
      const assetPath = item.assetPath || item.linkPreviewPath;
      if (assetPath) {
        readAsset(vaultPath, assetPath).then(setImageSrc).catch(console.error);
      }
    }
  }, [item?.id, item?.assetPath, item?.linkPreviewPath, vaultPath]);

  useEffect(() => {
    if (item) {
      setTitleValue(item.title || item.linkTitle || "");
      setUrlValue(item.url || "");
      setExcerptValue(item.excerpt || "");
      setDescriptionValue(item.linkDescription || "");
      setEditingTitle(false);
      setEditingUrl(false);
      setEditingExcerpt(false);
      setEditingDescription(false);
    }
  }, [item?.id, item?.title, item?.linkDescription]);

  if (!item) return null;

  const displayTitle = item.title || item.linkTitle || "Untitled";

  const handleTitleSave = () => {
    setEditingTitle(false);
    if (titleValue !== (item.title || item.linkTitle || "")) {
      if (item.type === "link") {
        updateItemField(item.id, { linkTitle: titleValue });
      } else {
        updateItemField(item.id, { title: titleValue });
      }
    }
  };

  const handleUrlSave = () => {
    setEditingUrl(false);
    if (urlValue !== (item.url || "")) {
      updateItemField(item.id, { url: urlValue || undefined });
    }
  };

  const handleExcerptSave = () => {
    setEditingExcerpt(false);
    if (excerptValue !== (item.excerpt || "")) {
      updateItemField(item.id, { excerpt: excerptValue || undefined });
    }
  };

  const handleDescriptionSave = () => {
    setEditingDescription(false);
    if (descriptionValue !== (item.linkDescription || "")) {
      updateItemField(item.id, {
        linkDescription: descriptionValue || undefined,
      });
    }
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (!tag || item.tags.includes(tag)) {
      setTagInput("");
      setShowTagInput(false);
      return;
    }
    updateItemTags(item.id, [...item.tags, tag]);
    setTagInput("");
    setShowTagInput(false);
  };

  const handleRemoveTag = (tag: string) => {
    updateItemTags(
      item.id,
      item.tags.filter((t) => t !== tag),
    );
  };

  const handleDelete = () => {
    removeItem(item.id);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex bg-black/60"
      onClick={() => selectItem(null)}
    >
      <div
        className="flex w-full max-w-5xl m-auto h-[85vh] bg-surface rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: Preview */}
        <div className="flex-1 bg-bg flex items-center justify-center overflow-hidden p-6 min-w-0">
          {isPending ? (
            <div className="w-full h-80 bg-surface rounded-lg animate-pulse" />
          ) : (
            <>
              {item.type === "image" && imageSrc && (
                <img
                  src={imageSrc}
                  alt={displayTitle}
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              )}
              {item.type === "link" && imageSrc && (
                <img
                  src={imageSrc}
                  alt={displayTitle}
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              )}
              {item.type === "link" && !imageSrc && (
                <div className="w-full h-64 bg-surface rounded-lg flex items-center justify-center">
                  <svg
                    className="w-16 h-16 text-text-muted"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={1}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.04a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.34 8.798"
                    />
                  </svg>
                </div>
              )}
              {item.type === "text" && (
                <div className="w-full max-w-md">
                  <textarea
                    value={editingExcerpt ? excerptValue : item.excerpt || ""}
                    onChange={(e) => setExcerptValue(e.target.value)}
                    onFocus={() => {
                      if (!editingExcerpt) {
                        setExcerptValue(item.excerpt || "");
                        setEditingExcerpt(true);
                      }
                    }}
                    onBlur={handleExcerptSave}
                    placeholder="Write your note..."
                    rows={Math.max(8, (item.excerpt || "").split("\n").length + 1)}
                    className="w-full px-4 py-3 bg-transparent rounded-lg text-[#A8B4C6] leading-relaxed text-md outline-none resize-none placeholder:text-text-muted"
                  />
                </div>
              )}
              {item.type === "video" && videoSrc && (
                <video
                  src={videoSrc}
                  controls
                  loop
                  autoPlay
                  muted
                  playsInline
                  className="max-w-full max-h-full rounded-lg"
                />
              )}
              {item.type === "video" && !videoSrc && (
                <div className="w-full h-64 bg-surface rounded-lg animate-pulse" />
              )}
              {item.type === "image" && !imageSrc && (
                <div className="w-full h-64 bg-surface rounded-lg animate-pulse" />
              )}
            </>
          )}
        </div>

        {/* Right: Details */}
        <div className="w-80 shrink-0 border-l border-border flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
              {typeLabel(item.type)}
            </span>
            <button
              onClick={() => selectItem(null)}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-bg transition-colors cursor-pointer"
            >
              <svg
                className="w-4 h-4 text-text-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
            {isPending ? (
              <div className="flex flex-col gap-5 animate-pulse">
                <div>
                  <div className="h-8 w-48 bg-[#18191A] rounded-lg mb-2" />
                  <div className="h-4 w-32 bg-[#18191A] rounded" />
                </div>
                <div>
                  <div className="h-3 w-12 bg-[#18191A] rounded mb-2" />
                  <div className="h-4 w-full bg-[#18191A] rounded" />
                </div>
                <div>
                  <div className="h-3 w-20 bg-[#18191A] rounded mb-2" />
                  <div className="h-10 w-full bg-[#18191A] rounded" />
                </div>
                <div>
                  <div className="h-3 w-10 bg-[#18191A] rounded mb-2" />
                  <div className="flex gap-1.5">
                    <div className="h-7 w-16 bg-[#18191A] rounded-full" />
                    <div className="h-7 w-20 bg-[#18191A] rounded-full" />
                    <div className="h-7 w-14 bg-[#18191A] rounded-full" />
                  </div>
                </div>
              </div>
            ) : (
            <>
            {/* Title */}
            <div>
              {isEnriching && !item.title && !item.linkTitle ? (
                <div className="h-8 w-48 bg-[#18191A] rounded-lg animate-pulse my-2" />
              ) : editingTitle ? (
                <input
                  autoFocus
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  placeholder="Title goes here..."
                  onBlur={handleTitleSave}
                  onKeyDown={(e) => e.key === "Enter" && handleTitleSave()}
                  className="w-full px-0 py-2 bg-transparent rounded-lg font-semibold text-2xl text-text outline-none"
                />
              ) : (
                <button
                  onClick={() => setEditingTitle(true)}
                  className="w-full text-left px-0 py-2 bg-transparent rounded-lg font-semibold text-2xl text-text transition-shadow cursor-pointer"
                >
                  {displayTitle}
                </button>
              )}
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#5C626B]">
                  {formatDate(item.createdAt)}
                </p>
                {item.width && item.height && (
                  <p className="text-sm text-[#5C626B]">
                    {item.width}px × {item.height}px
                  </p>
                )}
              </div>
            </div>

            {/* URL (all types) */}
            <div>
              <label className="text-xs font-medium text-[#5C626B] uppercase tracking-wide mb-1.5 block">
                Link
              </label>
              {editingUrl ? (
                <input
                  autoFocus
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  onBlur={handleUrlSave}
                  onKeyDown={(e) => e.key === "Enter" && handleUrlSave()}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-bg rounded-lg text-sm text-[#A8B4C6] outline-none focus:ring-2 focus:ring-white/20"
                />
              ) : item.url ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openUrl(item.url!)}
                    className="flex-1 px-0 py-2 bg-transparent rounded-lg text-sm text-[#A8B4C6] truncate hover:underline text-left cursor-pointer"
                  >
                    {item.url}
                  </button>
                  <button
                    onClick={() => setEditingUrl(true)}
                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-bg transition-colors cursor-pointer"
                  >
                    <svg
                      className="w-3.5 h-3.5 text-[#A8B4C6]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z"
                      />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingUrl(true)}
                  className="w-full text-left px-0 py-2 bg-transparent rounded-lg text-sm text-[#5C626B] transition-shadow cursor-pointer"
                >
                  Add a link...
                </button>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-medium text-[#5C626B] uppercase tracking-wide mb-1.5 block">
                Description
              </label>
              {isEnriching && !item.linkDescription ? (
                <div className="space-y-1.5 animate-pulse">
                  <div className="h-4 w-full bg-[#18191A] rounded" />
                  <div className="h-4 w-3/4 bg-[#18191A] rounded" />
                </div>
              ) : editingDescription ? (
                <textarea
                  autoFocus
                  value={descriptionValue}
                  onChange={(e) => setDescriptionValue(e.target.value)}
                  onBlur={handleDescriptionSave}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") handleDescriptionSave();
                  }}
                  placeholder="Add a description..."
                  rows={3}
                  className="w-full px-3 py-2 bg-bg rounded-lg text-sm text-[#A8B4C6] leading-relaxed outline-none resize-none focus:ring-2 focus:ring-white/20"
                />
              ) : item.linkDescription ? (
                <button
                  onClick={() => setEditingDescription(true)}
                  className="w-full text-left px-0 py-2 bg-transparent rounded-lg text-sm text-[#A8B4C6] leading-relaxed cursor-pointer"
                >
                  {item.linkDescription}
                </button>
              ) : (
                <button
                  onClick={() => setEditingDescription(true)}
                  className="w-full text-left px-0 py-2 bg-transparent rounded-lg text-sm text-[#5C626B] transition-shadow cursor-pointer"
                >
                  Add a description...
                </button>
              )}
            </div>

            {/* Tags */}
            <div>
              <label className="text-xs font-medium text-[#5C626B] uppercase tracking-wide mb-1.5 block">
                Tags
              </label>
              {showTagInput && (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddTag();
                      if (e.key === "Escape") {
                        setShowTagInput(false);
                        setTagInput("");
                      }
                    }}
                    onBlur={() => {
                      if (!tagInput.trim()) {
                        setShowTagInput(false);
                        setTagInput("");
                      }
                    }}
                    placeholder="Add tag..."
                    className="flex-1 px-3 py-1.5 bg-bg rounded-lg text-sm text-text placeholder:text-text-muted outline-none focus:ring-2 focus:ring-white/20"
                  />
                  <button
                    onClick={handleAddTag}
                    disabled={!tagInput.trim()}
                    className="px-3 py-1.5 bg-white text-bg text-xs font-semibold rounded-lg hover:bg-white/90 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
              )}
              {isEnriching && item.tags.length === 0 ? (
                <div className="flex flex-wrap gap-1.5 mb-2 mt-2 animate-pulse">
                  <div className="h-7 w-16 bg-[#18191A] rounded-full" />
                  <div className="h-7 w-20 bg-[#18191A] rounded-full" />
                  <div className="h-7 w-14 bg-[#18191A] rounded-full" />
                </div>
              ) : (
              <div className="flex flex-wrap gap-1.5 mb-2 mt-2">
                {!showTagInput && (
                  <button
                    onClick={() => setShowTagInput(true)}
                    className="inline-flex items-center px-4 py-2 gap-2 bg-[#18191A] text-[#5C626B] text-xs font-medium rounded-full hover:text-text transition-colors cursor-pointer"
                  >
                    <PlusIcon size={14} /> Add
                  </button>
                )}
                {item.tags.map((tag) => (
                  <TagPill
                    key={tag}
                    tag={tag}
                    onRemove={() => handleRemoveTag(tag)}
                  />
                ))}
              </div>
              )}
            </div>

            {/* Collections */}
            <CollectionPicker
              itemId={item.id}
              collectionIds={item.collectionIds || []}
            />
            </>
            )}
          </div>

          {/* Footer actions */}
          <div className="p-4 border-t border-border flex gap-2">
            <button
              onClick={handleDelete}
              className="flex-1 py-2 text-sm font-medium text-red-400 bg-red-400/10 rounded-lg hover:bg-red-400/20 transition-colors cursor-pointer"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
