import { useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import { useBoardStore } from "../stores/board-store";
import { BookCard } from "./BookCard";
import type { Book } from "../types";

const GRID_CLASS =
  "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-x-4 gap-y-6";

// Books can only be reordered within their own section
function groupOf(book: Book): string {
  return book.status === "read" ? `read-${book.yearRead ?? 0}` : book.status;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <BookOpen size={64} strokeWidth={1} className="text-border" />
        <p className="text-text-muted text-sm">{message}</p>
      </div>
    </div>
  );
}

export function BooksView() {
  const books = useBoardStore((s) => s.books);
  const booksTab = useBoardStore((s) => s.booksTab);
  const moveBook = useBoardStore((s) => s.moveBook);
  const persistBookOrder = useBoardStore((s) => s.persistBookOrder);
  const [dragId, setDragId] = useState<string | null>(null);

  // Array order is the display order (drag & drop reorders it)
  const reading = useMemo(() => books.filter((b) => b.status === "reading"), [books]);
  const wantToRead = useMemo(() => books.filter((b) => b.status === "want"), [books]);

  const readByYear = useMemo(() => {
    const read = books.filter((b) => b.status === "read");
    const groups = new Map<number, Book[]>();
    for (const book of read) {
      const year = book.yearRead ?? 0;
      if (!groups.has(year)) groups.set(year, []);
      groups.get(year)!.push(book);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => b - a)
      .map(([year, items]) => ({ year, items }));
  }, [books]);

  const handleDragOver = (e: React.DragEvent, over: Book) => {
    e.preventDefault();
    if (!dragId || dragId === over.id) return;
    const dragged = books.find((b) => b.id === dragId);
    if (!dragged || groupOf(dragged) !== groupOf(over)) return;
    moveBook(dragId, over.id);
  };

  const renderGrid = (items: Book[]) => (
    <div className={GRID_CLASS}>
      {items.map((book) => (
        <div
          key={book.id}
          draggable
          onDragStart={(e) => {
            setDragId(book.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => handleDragOver(e, book)}
          onDragEnd={() => {
            setDragId(null);
            persistBookOrder();
          }}
          className={`transition-opacity ${dragId === book.id ? "opacity-40" : ""}`}
        >
          <BookCard book={book} />
        </div>
      ))}
    </div>
  );

  if (booksTab === "want") {
    if (wantToRead.length === 0) {
      return <EmptyState message="No books here yet — add books you want to read" />;
    }
    return (
      <div className="flex-1 overflow-y-auto p-6">{renderGrid(wantToRead)}</div>
    );
  }

  if (reading.length === 0 && readByYear.length === 0) {
    return <EmptyState message="Add the book you're currently reading to get started" />;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex flex-col gap-10">
        {reading.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
              Reading
            </h2>
            {renderGrid(reading)}
          </section>
        )}

        {readByYear.map(({ year, items }) => (
          <section key={year}>
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
              {year === 0 ? "Earlier" : year}
            </h2>
            {renderGrid(items)}
          </section>
        ))}
      </div>
    </div>
  );
}
