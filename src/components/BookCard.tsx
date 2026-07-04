import { useEffect, useRef, useState } from "react";
import { BookOpen } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useBoardStore } from "../stores/board-store";
import { readAsset } from "../lib/tauri-commands";
import { BookEditModal } from "./BookEditModal";
import type { Book } from "../types";

interface BookCardProps {
  book: Book;
}

export function BookCard({ book }: BookCardProps) {
  const vaultPath = useBoardStore((s) => s.vaultPath);
  const updateBook = useBoardStore((s) => s.updateBook);
  const setBookCover = useBoardStore((s) => s.setBookCover);
  const removeBook = useBoardStore((s) => s.removeBook);
  const [src, setSrc] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [editingYear, setEditingYear] = useState(false);
  const [yearValue, setYearValue] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!book.coverPath || !vaultPath) return;
    readAsset(vaultPath, book.coverPath).then(setSrc).catch(console.error);
  }, [vaultPath, book.coverPath]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu(null);
      }
    };
    if (menu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menu]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setEditingYear(false);
    setMenu({ x: e.clientX, y: e.clientY });
  };

  const handlePickCover = async () => {
    setMenu(null);
    const selected = await open({
      title: "Select a cover image",
      filters: [
        {
          name: "Images",
          extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp"],
        },
      ],
    });
    if (selected) {
      try {
        await setBookCover(book.id, selected);
      } catch (e) {
        console.error("Failed to set cover:", e);
      }
    }
  };

  const handleYearSubmit = () => {
    const year = parseInt(yearValue, 10);
    if (!Number.isNaN(year)) updateBook(book.id, { yearRead: year });
    setEditingYear(false);
    setMenu(null);
  };

  const action = (fn: () => void) => () => {
    fn();
    setMenu(null);
  };

  const menuItemClass =
    "w-full px-4 py-2.5 text-sm text-[#A8B4C6] hover:bg-[#18191A] transition-colors cursor-pointer text-left";

  return (
    <>
      <div className="group cursor-pointer" onContextMenu={handleContextMenu}>
        <div className="book-3d">
          <div className="book-3d-inner">
            <div className="book-3d-back" />
            <div className="book-3d-pages" />
            <div className="book-3d-cover">
              {book.coverPath ? (
                src ? (
                  <img src={src} alt={book.title} loading="lazy" draggable={false} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-surface animate-pulse" />
                )
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3 pl-5 text-center bg-[#1A1B1D]">
                  <BookOpen size={24} className="text-text-muted" />
                  <span className="text-xs text-text-muted line-clamp-4">{book.title}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <p className="mt-2 text-sm font-medium text-text line-clamp-2">{book.title}</p>
        {book.author && (
          <p className="text-xs text-text-muted line-clamp-1">{book.author}</p>
        )}
        {book.status === "read" && book.yearRead && (
          <p className="text-xs text-text-muted mt-0.5">Read in {book.yearRead}</p>
        )}
      </div>

      {menu && (
        <div
          ref={menuRef}
          className="fixed z-[200] w-48 bg-[#0F1010] border border-border rounded-xl shadow-2xl overflow-hidden"
          style={{ left: menu.x, top: menu.y }}
        >
          {book.status !== "reading" && (
            <button
              onClick={action(() => updateBook(book.id, { status: "reading", yearRead: undefined }))}
              className={menuItemClass}
            >
              Start reading
            </button>
          )}
          {book.status !== "read" && (
            <button
              onClick={action(() =>
                updateBook(book.id, { status: "read", yearRead: new Date().getFullYear() }),
              )}
              className={menuItemClass}
            >
              Mark as read
            </button>
          )}
          {book.status === "read" && (
            editingYear ? (
              <div className="px-3 py-2">
                <input
                  autoFocus
                  type="number"
                  value={yearValue}
                  onChange={(e) => setYearValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleYearSubmit();
                    if (e.key === "Escape") setEditingYear(false);
                  }}
                  className="w-full px-3 py-1.5 bg-[#18191A] rounded-lg text-sm text-text outline-none"
                  placeholder="Year read"
                />
              </div>
            ) : (
              <button
                onClick={() => {
                  setYearValue(String(book.yearRead ?? new Date().getFullYear()));
                  setEditingYear(true);
                }}
                className={menuItemClass}
              >
                Change year
              </button>
            )
          )}
          {book.status !== "want" && (
            <button
              onClick={action(() => updateBook(book.id, { status: "want", yearRead: undefined }))}
              className={menuItemClass}
            >
              Move to Want to read
            </button>
          )}
          <button
            onClick={() => {
              setMenu(null);
              setShowEditModal(true);
            }}
            className={menuItemClass}
          >
            Edit details
          </button>
          <button onClick={handlePickCover} className={menuItemClass}>
            {book.coverPath ? "Change cover" : "Add cover"}
          </button>
          <button
            onClick={action(() => removeBook(book.id))}
            className="w-full px-4 py-2.5 text-sm text-red-400 hover:bg-[#18191A] transition-colors cursor-pointer text-left"
          >
            Delete
          </button>
        </div>
      )}

      {showEditModal && (
        <BookEditModal book={book} onClose={() => setShowEditModal(false)} />
      )}
    </>
  );
}
