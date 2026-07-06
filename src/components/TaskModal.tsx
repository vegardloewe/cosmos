import { useState } from "react";
import { useBoardStore } from "../stores/board-store";
import type { Task, TaskEffort, TaskPriority, TaskStatus } from "../types";
import { EFFORTS, PRIORITIES, STATUSES, PriorityIcon, StatusIcon } from "./task-meta";
import { DeadlinePicker } from "./DeadlinePicker";

interface TaskModalProps {
  onClose: () => void;
  task?: Task; // present = edit mode
  initialStatus?: TaskStatus; // for "+" on a specific column
}

function PickerRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-text-muted mb-1.5">{label}</p>
      <div className="flex items-center gap-1.5 flex-wrap">{children}</div>
    </div>
  );
}

function PickerButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
        active
          ? "bg-[#2A2B2D] border-[#3A3D42] text-white"
          : "bg-bg border-transparent text-[#A8B4C6] hover:text-text hover:border-border"
      }`}
    >
      {children}
    </button>
  );
}

export function TaskModal({ onClose, task, initialStatus }: TaskModalProps) {
  const addTask = useBoardStore((s) => s.addTask);
  const updateTask = useBoardStore((s) => s.updateTask);

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? initialStatus ?? "backlog");
  const [priority, setPriority] = useState<TaskPriority | null>(task?.priority ?? null);
  const [effort, setEffort] = useState<TaskEffort | null>(task?.effort ?? null);
  const [deadline, setDeadline] = useState<string | null>(task?.deadline ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setIsSubmitting(true);
    try {
      if (task) {
        await updateTask(task.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          status,
          priority: priority ?? undefined,
          effort: effort ?? undefined,
          deadline: deadline ?? undefined,
        });
      } else {
        await addTask(title.trim(), description.trim() || null, status, priority, effort, deadline);
      }
      onClose();
    } catch (e) {
      console.error("Failed to save task:", e);
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
          {task ? "Edit task" : "New task"}
        </h2>

        <input
          autoFocus
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
          className="w-full px-4 py-3 bg-bg rounded-xl text-text placeholder:text-text-muted outline-none focus:ring-2 focus:ring-white/20"
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={3}
          className="w-full px-4 py-3 bg-bg rounded-xl text-text placeholder:text-text-muted outline-none focus:ring-2 focus:ring-white/20 resize-none"
        />

        <PickerRow label="Status">
          {STATUSES.map((s) => (
            <PickerButton key={s.value} active={status === s.value} onClick={() => setStatus(s.value)}>
              <StatusIcon status={s.value} size={12} />
              {s.label}
            </PickerButton>
          ))}
        </PickerRow>

        <PickerRow label="Priority">
          <PickerButton active={priority === null} onClick={() => setPriority(null)}>
            None
          </PickerButton>
          {PRIORITIES.map((p) => (
            <PickerButton
              key={p.value}
              active={priority === p.value}
              onClick={() => setPriority(p.value)}
            >
              <PriorityIcon priority={p.value} size={12} />
              {p.label}
            </PickerButton>
          ))}
        </PickerRow>

        <PickerRow label="Deadline">
          <DeadlinePicker
            value={deadline ?? undefined}
            onChange={setDeadline}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-transparent bg-bg text-[#A8B4C6] hover:text-text hover:border-border transition-colors"
          />
        </PickerRow>

        <PickerRow label="Effort">
          <PickerButton active={effort === null} onClick={() => setEffort(null)}>
            None
          </PickerButton>
          {EFFORTS.map((ef) => (
            <PickerButton
              key={ef.value}
              active={effort === ef.value}
              onClick={() => setEffort(ef.value)}
            >
              {ef.label}
            </PickerButton>
          ))}
        </PickerRow>

        <button
          onClick={handleSave}
          disabled={isSubmitting || !title.trim()}
          className="w-full py-3 bg-white text-bg font-semibold rounded-xl hover:bg-white/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Saving..." : task ? "Save Changes" : "Add Task"}
        </button>
      </div>
    </div>
  );
}
