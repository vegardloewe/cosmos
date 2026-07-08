import { useState } from "react";
import { useBoardStore } from "../stores/board-store";
import type { Book } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

        <Input
          autoFocus
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />
        <Input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Author (optional)"
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />

        <Button className="w-full" onClick={handleSave} disabled={isSubmitting || !title.trim()}>
          {isSubmitting ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
