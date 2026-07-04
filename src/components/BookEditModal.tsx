import { useState } from "react";
import { useBoardStore } from "../stores/board-store";
import type { Book } from "../types";

interface BookEditModalProps {
  book: Book;
  onClose: () => void;
}

export function BookEditModal({ book, onClose }: BookEditModalProps) {
  const updateBook = useBoardStore((s) => s.updateBook);
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setIsSubmitting(true);
    try {
      await updateBook(book.id, {
        title: title.trim(),
        author: author.trim() || undefined,
      });
      onClose();
    } catch (e) {
      console.error("Failed to update book:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-text">Edit book</h2>

        <input
          autoFocus
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full px-4 py-3 bg-bg rounded-xl text-text placeholder:text-text-muted outline-none focus:ring-2 focus:ring-white/20"
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />
        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Author (optional)"
          className="w-full px-4 py-3 bg-bg rounded-xl text-text placeholder:text-text-muted outline-none focus:ring-2 focus:ring-white/20"
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />

        <button
          onClick={handleSave}
          disabled={isSubmitting || !title.trim()}
          className="w-full py-3 bg-white text-bg font-semibold rounded-xl hover:bg-white/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
