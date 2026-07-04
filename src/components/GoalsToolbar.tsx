import { useState } from "react";
import { Plus } from "lucide-react";
import { useBoardStore } from "../stores/board-store";
import { GoalModal } from "./GoalModal";

export function GoalsToolbar() {
  const appMode = useBoardStore((s) => s.appMode);
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <>
      <div
        className={`flex-1 items-center justify-end gap-2 relative z-10 ${
          appMode === "goals" ? "flex" : "hidden"
        }`}
      >
        <button
          onClick={() => setShowAddModal(true)}
          className="p-1.5 bg-transparent text-[#A8B4C6] rounded-full hover:text-text hover:bg-[#0F1010] transition-colors cursor-pointer"
        >
          <Plus size={18} strokeWidth={2} />
        </button>
      </div>

      {showAddModal && <GoalModal onClose={() => setShowAddModal(false)} />}
    </>
  );
}
