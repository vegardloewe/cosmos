import { useEffect, useRef, useState } from "react";
import { BookOpen, ArrowLeft } from "lucide-react";
import { useBoardStore } from "../stores/board-store";
import { searchBooks } from "../lib/tauri-commands";
import type { BookSearchResult, BookStatus } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AddBookModalProps {
  onClose: () => void;
}

const STATUS_OPTIONS: { label: string; value: BookStatus }[] = [
  { label: "Reading", value: "reading" },
  { label: "Read", value: "read" },
  { label: "Want to read", value: "want" },
];

export function AddBookModal({ onClose }: AddBookModalProps) {
  const booksTab = useBoardStore((s) => s.booksTab);
  const addBook = useBoardStore((s) => s.addBook);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selected, setSelected] = useState<BookSearchResult | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [status, setStatus] = useState<BookStatus>(booksTab === "want" ? "want" : "reading");
  const [yearRead, setYearRead] = useState(String(new Date().getFullYear()));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchCounter = useRef(0);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setHasSearched(false);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    searchTimeout.current = setTimeout(async () => {
      const requestId = ++searchCounter.current;
      try {
        const found = await searchBooks(trimmed);
        if (requestId === searchCounter.current) {
          setResults(found);
          setHasSearched(true);
        }
      } catch (e) {
        console.error("Book search failed:", e);
      } finally {
        if (requestId === searchCounter.current) setIsSearching(false);
      }
    }, 400);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [query]);

  const selectBook = (result: BookSearchResult) => {
    setSelected(result);
    setTitle(result.title);
    setAuthor(result.author ?? "");
  };

  const selectManual = () => {
    setSelected({ title: query.trim() });
    setTitle(query.trim());
    setAuthor("");
  };

  const handleAdd = async () => {
    if (!selected || !title.trim()) return;
    setIsSubmitting(true);
    try {
      const year = status === "read" ? parseInt(yearRead, 10) : NaN;
      await addBook(
        title.trim(),
        author.trim() || null,
        selected.coverUrl ?? null,
        status,
        Number.isNaN(year) ? null : year,
      );
      onClose();
    } catch (e) {
      console.error("Failed to add book:", e);
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
        className="bg-surface rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {selected ? (
          <div className="p-6 flex flex-col gap-4">
            <button
              onClick={() => setSelected(null)}
              className="flex items-center gap-2 text-sm text-text-muted hover:text-text transition-colors cursor-pointer self-start"
            >
              <ArrowLeft size={16} />
              Back to search
            </button>

            <div className="flex gap-4">
              {selected.coverUrl ? (
                <img
                  src={selected.coverUrl}
                  alt={title}
                  className="w-20 aspect-[2/3] object-cover rounded-lg shadow-lg shrink-0"
                />
              ) : (
                <div className="w-20 aspect-[2/3] rounded-lg bg-bg flex items-center justify-center shrink-0">
                  <BookOpen size={20} className="text-text-muted" />
                </div>
              )}
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <Input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Title"
                  className="h-9 px-3"
                />
                <Input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Author (optional)"
                  className="h-9 px-3"
                />
                {selected.firstPublishYear && (
                  <p className="text-xs text-text-muted">
                    First published {selected.firstPublishYear}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatus(opt.value)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                    status === opt.value
                      ? "bg-white text-bg"
                      : "bg-bg text-[#A8B4C6] hover:text-text"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {status === "read" && (
              <Input
                type="number"
                value={yearRead}
                onChange={(e) => setYearRead(e.target.value)}
                placeholder="Year read"
              />
            )}

            <Button className="w-full" onClick={handleAdd} disabled={isSubmitting || !title.trim()}>
              {isSubmitting ? "Adding..." : "Add book"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="p-6 pb-4">
              <Input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search books by title or author..."
              />
            </div>

            <div className="h-72 overflow-y-auto px-2">
              {isSearching && (
                <p className="px-4 py-3 text-sm text-text-muted">Searching...</p>
              )}
              {!isSearching && results.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-6">
                  <BookOpen size={32} strokeWidth={1.5} className="text-border" />
                  <p className="text-sm text-text-muted">
                    {hasSearched
                      ? "No books found — try a different search or add it manually"
                      : "Search Open Library to add a book"}
                  </p>
                </div>
              )}
              {!isSearching &&
                results.map((result, i) => (
                  <button
                    key={i}
                    onClick={() => selectBook(result)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-[#18191A] transition-colors cursor-pointer text-left"
                  >
                    {result.coverUrl ? (
                      <img
                        src={result.coverUrl.replace("-L.jpg", "-M.jpg")}
                        alt=""
                        loading="lazy"
                        className="w-10 h-14 object-cover rounded shadow shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-14 rounded bg-bg flex items-center justify-center shrink-0">
                        <BookOpen size={14} className="text-text-muted" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text truncate">{result.title}</p>
                      <p className="text-xs text-text-muted truncate">
                        {[result.author, result.firstPublishYear].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </button>
                ))}
            </div>

            {/* Always available: add without picking a search result */}
            <div className="border-t border-border p-3">
              <button
                onClick={selectManual}
                className="w-full py-2 rounded-xl text-sm text-[#A8B4C6] hover:text-text hover:bg-[#18191A] transition-colors cursor-pointer"
              >
                {query.trim() ? `Add "${query.trim()}" manually` : "Add manually"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
