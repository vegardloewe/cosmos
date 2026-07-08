import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useBoardStore } from "../stores/board-store";
import { MarkdownEditor } from "./MarkdownEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Tab = "image" | "video" | "link" | "note";

interface AddModalProps {
  onClose: () => void;
}

export function AddModal({ onClose }: AddModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("image");
  const [url, setUrl] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addImage = useBoardStore((s) => s.addImage);
  const addVideo = useBoardStore((s) => s.addVideo);
  const addLink = useBoardStore((s) => s.addLink);
  const addNote = useBoardStore((s) => s.addNote);

  const handleImageBrowse = async () => {
    const selected = await open({
      title: "Select an image",
      filters: [
        {
          name: "Images",
          extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"],
        },
      ],
    });
    if (selected) {
      setIsSubmitting(true);
      try {
        await addImage(selected);
        onClose();
      } catch (e) {
        console.error("Failed to import image:", e);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleAddLink = async () => {
    if (!url.trim()) return;
    setIsSubmitting(true);
    try {
      await addLink(url.trim());
      onClose();
    } catch (e) {
      console.error("Failed to add link:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveNote = async () => {
    if (!noteTitle.trim() && !noteContent.trim()) return;
    setIsSubmitting(true);
    try {
      await addNote(noteTitle.trim(), noteContent.trim());
      onClose();
    } catch (e) {
      console.error("Failed to save note:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVideoBrowse = async () => {
    const selected = await open({
      title: "Select a video",
      filters: [
        {
          name: "Videos",
          extensions: ["mp4", "webm", "mov", "mkv", "avi"],
        },
      ],
    });
    if (selected) {
      setIsSubmitting(true);
      try {
        await addVideo(selected);
        onClose();
      } catch (e) {
        console.error("Failed to import video:", e);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "image", label: "Image" },
    { key: "video", label: "Video" },
    { key: "link", label: "Link" },
    { key: "note", label: "Note" },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tabs */}
        <div className="flex border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3 text-sm font-medium transition-colors cursor-pointer ${
                activeTab === tab.key
                  ? "text-white border-b-2 border-white"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 h-72">
          {activeTab === "image" && (
            <button
              onClick={handleImageBrowse}
              disabled={isSubmitting}
              className="w-full h-full border-2 border-dashed border-border rounded-xl text-text-muted hover:border-white hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            >
              <div className="flex flex-col items-center gap-2">
                <svg
                  className="w-10 h-10"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z"
                  />
                </svg>
                <span className="text-sm font-medium">
                  {isSubmitting
                    ? "Importing..."
                    : "Drop images here or click to browse"}
                </span>
              </div>
            </button>
          )}

          {activeTab === "video" && (
            <button
              onClick={handleVideoBrowse}
              disabled={isSubmitting}
              className="w-full h-full border-2 border-dashed border-border rounded-xl text-text-muted hover:border-white hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            >
              <div className="flex flex-col items-center gap-2">
                <svg
                  className="w-10 h-10"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
                  />
                </svg>
                <span className="text-sm font-medium">
                  {isSubmitting
                    ? "Importing..."
                    : "Click to browse for videos"}
                </span>
              </div>
            </button>
          )}

          {activeTab === "link" && (
            <div className="flex flex-col gap-4 h-full justify-center">
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                onKeyDown={(e) => e.key === "Enter" && handleAddLink()}
              />
              <Button className="w-full" onClick={handleAddLink} disabled={isSubmitting || !url.trim()}>
                {isSubmitting ? "Adding..." : "Add link"}
              </Button>
            </div>
          )}

          {activeTab === "note" && (
            <div className="flex flex-col gap-4 h-full">
              <Input
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Title"
              />
              <MarkdownEditor
                value={noteContent}
                onChange={setNoteContent}
                placeholder="Write your note..."
                rows={6}
                className="w-full flex-1 px-4 py-3 bg-bg rounded-xl text-text placeholder:text-text-muted outline-none focus:ring-2 focus:ring-white/20 resize-none"
              />
              <Button
                className="w-full"
                onClick={handleSaveNote}
                disabled={isSubmitting || (!noteTitle.trim() && !noteContent.trim())}
              >
                {isSubmitting ? "Saving..." : "Save note"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
