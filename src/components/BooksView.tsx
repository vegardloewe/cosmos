import { useMemo } from "react";
import { BookOpen } from "lucide-react";
import { useBoardStore } from "../stores/board-store";
import { BookCard } from "./BookCard";
import type { Book } from "../types";

const GRID_CLASS =
  "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-x-4 gap-y-6";

function byNewest(a: Book, b: Book) {
  return Number(b.createdAt) - Number(a.createdAt);
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

  const reading = useMemo(
    () => books.filter((b) => b.status === "reading").sort(byNewest),
    [books],
  );

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
      .map(([year, items]) => ({ year, items: items.sort(byNewest) }));
  }, [books]);

  const wantToRead = useMemo(
    () => books.filter((b) => b.status === "want").sort(byNewest),
    [books],
  );

  if (booksTab === "want") {
    if (wantToRead.length === 0) {
      return <EmptyState message="No books here yet — add books you want to read" />;
    }
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className={GRID_CLASS}>
          {wantToRead.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      </div>
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
              Currently reading
            </h2>
            <div className={GRID_CLASS}>
              {reading.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          </section>
        )}

        {readByYear.map(({ year, items }) => (
          <section key={year}>
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
              {year === 0 ? "Earlier" : year}
            </h2>
            <div className={GRID_CLASS}>
              {items.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
