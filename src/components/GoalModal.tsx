import { useMemo, useState } from "react";
import { useBoardStore } from "../stores/board-store";
import type { Goal } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface GoalModalProps {
  onClose: () => void;
  goal?: Goal; // present = edit mode
}

export function GoalModal({ onClose, goal }: GoalModalProps) {
  const goals = useBoardStore((s) => s.goals);
  const addGoal = useBoardStore((s) => s.addGoal);
  const updateGoal = useBoardStore((s) => s.updateGoal);

  const [title, setTitle] = useState(goal?.title ?? "");
  const [category, setCategory] = useState(goal?.category ?? "");
  const [current, setCurrent] = useState(
    goal?.progressCurrent != null ? String(goal.progressCurrent) : "",
  );
  const [target, setTarget] = useState(
    goal?.progressTarget != null ? String(goal.progressTarget) : "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = useMemo(
    () => [...new Set(goals.map((g) => g.category))],
    [goals],
  );

  const parseNum = (value: string): number | null => {
    const n = parseFloat(value);
    return Number.isNaN(n) ? null : n;
  };

  const handleSave = async () => {
    if (!title.trim() || !category.trim()) return;
    setIsSubmitting(true);
    try {
      if (goal) {
        await updateGoal(goal.id, {
          title: title.trim(),
          category: category.trim(),
          progressCurrent: parseNum(current) ?? undefined,
          progressTarget: parseNum(target) ?? undefined,
        });
      } else {
        await addGoal(title.trim(), category.trim(), parseNum(current), parseNum(target));
      }
      onClose();
    } catch (e) {
      console.error("Failed to save goal:", e);
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
        <h2 className="text-lg font-semibold text-text">
          {goal ? "Edit goal" : "New goal"}
        </h2>

        <Input
          autoFocus
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Goal (e.g. 5k: 17:30)"
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />

        <Input
          type="text"
          list="goal-categories"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category (e.g. Running)"
        />
        <datalist id="goal-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        <div>
          <p className="text-xs text-text-muted mb-2">
            Progress (optional — e.g. 5 of 15 books)
          </p>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder="Current"
              className="flex-1"
            />
            <span className="text-text-muted">/</span>
            <Input
              type="number"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Target"
              className="flex-1"
            />
          </div>
        </div>

        <Button
          className="w-full"
          onClick={handleSave}
          disabled={isSubmitting || !title.trim() || !category.trim()}
        >
          {isSubmitting ? "Saving..." : goal ? "Save changes" : "Add goal"}
        </Button>
      </div>
    </div>
  );
}
