import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Target } from "lucide-react";
import { useBoardStore } from "../stores/board-store";
import { Checkbox } from "./Checkbox";
import { GoalModal } from "./GoalModal";
import type { Goal } from "../types";

function GoalRow({ goal, onEdit }: { goal: Goal; onEdit: (goal: Goal) => void }) {
  const updateGoal = useBoardStore((s) => s.updateGoal);
  const removeGoal = useBoardStore((s) => s.removeGoal);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const hasProgress = goal.progressTarget != null && goal.progressTarget > 0;
  const currentValue = goal.progressCurrent ?? 0;
  const pct = hasProgress
    ? Math.min((currentValue / goal.progressTarget!) * 100, 100)
    : 0;

  const handleIncrement = () => {
    const next = currentValue + 1;
    updateGoal(goal.id, {
      progressCurrent: next,
      // Reaching the target counts as achieving the goal
      achieved: goal.achieved || next >= goal.progressTarget!,
    });
  };

  return (
    <>
      <div
        className="group flex items-center gap-3 py-1.5"
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        <Checkbox
          checked={goal.achieved}
          onToggle={() => updateGoal(goal.id, { achieved: !goal.achieved })}
        />

        <span
          className={`flex-1 min-w-0 truncate text-[15px] ${
            goal.achieved ? "line-through text-text-muted" : "text-text"
          }`}
        >
          {goal.title}
        </span>

        {hasProgress && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-text-muted tabular-nums">
              {currentValue}/{goal.progressTarget}
            </span>
            <div className="w-24 h-1 rounded-full bg-surface overflow-hidden">
              <div
                className="h-full rounded-full bg-blue transition-[width] duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            {!goal.achieved && (
              <button
                onClick={handleIncrement}
                title="+1"
                className="p-1 rounded-full text-[#A8B4C6] opacity-0 group-hover:opacity-100 hover:text-text hover:bg-surface transition-all cursor-pointer"
              >
                <Plus size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {menu && (
        <div
          ref={menuRef}
          className="fixed z-[200] w-40 bg-[#0F1010] border border-border rounded-xl shadow-2xl overflow-hidden"
          style={{ left: menu.x, top: menu.y }}
        >
          <button
            onClick={() => {
              setMenu(null);
              onEdit(goal);
            }}
            className="w-full px-4 py-2.5 text-sm text-[#A8B4C6] hover:bg-[#18191A] transition-colors cursor-pointer text-left"
          >
            Edit
          </button>
          <button
            onClick={() => {
              setMenu(null);
              removeGoal(goal.id);
            }}
            className="w-full px-4 py-2.5 text-sm text-red-400 hover:bg-[#18191A] transition-colors cursor-pointer text-left"
          >
            Delete
          </button>
        </div>
      )}
    </>
  );
}

export function GoalsView() {
  const goals = useBoardStore((s) => s.goals);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  const year = new Date().getFullYear();
  const yearGoals = useMemo(
    () => goals.filter((g) => g.year === year),
    [goals, year],
  );

  const categories = useMemo(() => {
    const map = new Map<string, Goal[]>();
    for (const goal of yearGoals) {
      if (!map.has(goal.category)) map.set(goal.category, []);
      map.get(goal.category)!.push(goal);
    }
    return [...map.entries()];
  }, [yearGoals]);

  const achievedCount = yearGoals.filter((g) => g.achieved).length;

  if (yearGoals.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <Target size={64} strokeWidth={1} className="text-border" />
          <p className="text-text-muted text-sm">
            No goals for {year} yet — add your first one with the + button
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-xl mx-auto flex flex-col gap-8">
        {/* Year header with overall progress */}
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <h1 className="text-2xl font-bold tracking-tight text-text">{year}</h1>
            <span className="text-sm text-text-muted">
              {achievedCount} of {yearGoals.length} achieved
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-surface overflow-hidden">
            <div
              className="h-full rounded-full bg-blue transition-[width] duration-300"
              style={{
                width: `${yearGoals.length ? (achievedCount / yearGoals.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        {categories.map(([category, items]) => (
          <section key={category}>
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-2">
              {category}
            </h2>
            <div className="flex flex-col">
              {items.map((goal) => (
                <GoalRow key={goal.id} goal={goal} onEdit={setEditingGoal} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {editingGoal && (
        <GoalModal goal={editingGoal} onClose={() => setEditingGoal(null)} />
      )}
    </div>
  );
}
