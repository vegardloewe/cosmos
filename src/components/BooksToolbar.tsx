import { useState } from "react";
import { Plus } from "lucide-react";
import { useBoardStore } from "../stores/board-store";
import type { BooksTab } from "../stores/board-store";
import { AddBookModal } from "./AddBookModal";

const TABS: { label: string; value: BooksTab }[] = [
  { label: "Library", value: "library" },
  { label: "Want to read", value: "want" },
];

export function BooksToolbar() {
  const appMode = useBoardStore((s) => s.appMode);
  const booksTab = useBoardStore((s) => s.booksTab);
  const setBooksTab = useBoardStore((s) => s.setBooksTab);
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <>
      <div
        data-tauri-drag-region
        className={`flex-1 items-center justify-end gap-2 relative z-10 ${
          appMode === "books" ? "flex" : "hidden"
        }`}
      >
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setBooksTab(tab.value)}
            className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-colors cursor-pointer ${
              booksTab === tab.value
                ? "bg-[#0F1010] text-white"
                : "text-[#A8B4C6] hover:text-text hover:bg-[#0F1010]"
            }`}
          >
            {tab.label}
          </button>
        ))}
        <button
          onClick={() => setShowAddModal(true)}
          className="ml-2 p-1.5 bg-transparent text-[#A8B4C6] rounded-full hover:text-text hover:bg-[#0F1010] transition-colors cursor-pointer"
        >
          <Plus size={18} strokeWidth={2} />
        </button>
      </div>

      {showAddModal && <AddBookModal onClose={() => setShowAddModal(false)} />}
    </>
  );
}
