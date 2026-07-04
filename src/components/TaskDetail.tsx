import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useBoardStore } from "../stores/board-store";
import { MarkdownEditor } from "./MarkdownEditor";
import { EFFORTS, PRIORITIES, STATUSES, EffortPill, PriorityIcon, StatusIcon } from "./task-meta";

function formatDate(millis: string): string {
  const date = new Date(Number(millis));
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

interface PropertyOption {
  key: string;
  label: string;
  icon?: React.ReactNode;
}

// A sidebar property row that opens a dropdown of options (Linear-style)
function PropertySelect({
  value,
  placeholder,
  options,
  onSelect,
}: {
  value: PropertyOption | null;
  placeholder: string;
  options: PropertyOption[];
  onSelect: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] text-left transition-colors cursor-pointer hover:bg-[#18191A]"
      >
        {value ? (
          <>
            {value.icon}
            <span className="text-[#D7DCE5] truncate">{value.label}</span>
          </>
        ) : (
          <span className="text-text-muted">{placeholder}</span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-48 z-50 bg-[#0F1010] border border-border rounded-xl shadow-2xl overflow-hidden py-1">
          {options.map((option) => (
            <button
              key={option.key}
              onClick={() => {
                onSelect(option.key);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-left transition-colors cursor-pointer hover:bg-[#18191A] ${
                option.key === value?.key ? "text-white" : "text-[#A8B4C6]"
              }`}
            >
              {option.icon}
              <span className="truncate">{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="px-2 text-xs font-medium text-text-muted mb-1">{title}</p>
      {children}
    </div>
  );
}

export function TaskDetail({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const task = useBoardStore((s) => s.tasks.find((t) => t.id === taskId));
  const taskProjects = useBoardStore((s) => s.taskProjects);
  const updateTask = useBoardStore((s) => s.updateTask);
  const removeTask = useBoardStore((s) => s.removeTask);

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const titleRef = useRef<HTMLTextAreaElement>(null);

  // The textarea grows with its content (Linear-style wrapping title)
  const resizeTitle = () => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  useEffect(resizeTitle, [title]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        (document.activeElement as HTMLElement)?.blur?.();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!task) return null;

  const saveTitle = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== task.title) updateTask(task.id, { title: trimmed });
    else setTitle(task.title);
  };

  const saveDescription = () => {
    if (description !== (task.description ?? "")) {
      updateTask(task.id, { description: description || undefined });
    }
  };

  const project = taskProjects.find((p) => p.id === task.projectId);
  const status = STATUSES.find((s) => s.value === task.status)!;
  const priority = PRIORITIES.find((p) => p.value === task.priority);
  const effort = EFFORTS.find((ef) => ef.value === task.effort);

  return (
    <div className="fixed inset-0 z-[100] flex bg-black/60" onClick={onClose}>
      <div
        className="flex w-full max-w-5xl m-auto h-[85vh] bg-surface rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Main: title + rich text description */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-10 py-12 flex flex-col gap-6">
            <textarea
              ref={titleRef}
              rows={1}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLTextAreaElement).blur();
                }
              }}
              placeholder="Task title"
              className="w-full bg-transparent text-[26px] font-bold tracking-tight text-text leading-tight placeholder:text-text-muted outline-none resize-none overflow-hidden"
            />

            <MarkdownEditor
              value={task.description ?? ""}
              onChange={setDescription}
              onBlur={saveDescription}
              placeholder="Add a description..."
              rows={10}
              className="text-[15px] text-[#C6CCD6] leading-relaxed"
            />
          </div>
        </div>

        {/* Sidebar: properties */}
        <div className="w-64 shrink-0 border-l border-border flex flex-col bg-[#0B0C0C]">
          <div className="flex items-center justify-end p-3">
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full text-text-muted hover:text-text hover:bg-[#18191A] transition-colors cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-4 flex flex-col gap-6">
            <SidebarSection title="Properties">
              <PropertySelect
                value={{ key: status.value, label: status.label, icon: <StatusIcon status={status.value} /> }}
                placeholder="Set status"
                options={STATUSES.map((s) => ({
                  key: s.value,
                  label: s.label,
                  icon: <StatusIcon status={s.value} />,
                }))}
                onSelect={(key) => updateTask(task.id, { status: key as typeof task.status })}
              />
              <PropertySelect
                value={
                  priority
                    ? { key: priority.value, label: priority.label, icon: <PriorityIcon priority={priority.value} /> }
                    : null
                }
                placeholder="Set priority"
                options={[
                  { key: "", label: "No priority", icon: <PriorityIcon /> },
                  ...PRIORITIES.map((p) => ({
                    key: p.value,
                    label: p.label,
                    icon: <PriorityIcon priority={p.value} />,
                  })),
                ]}
                onSelect={(key) =>
                  updateTask(task.id, { priority: key ? (key as typeof task.priority) : undefined })
                }
              />
              <PropertySelect
                value={
                  effort
                    ? { key: effort.value, label: effort.label.toUpperCase(), icon: <EffortPill effort={effort.value} /> }
                    : null
                }
                placeholder="Set effort"
                options={[
                  { key: "", label: "No effort" },
                  ...EFFORTS.map((ef) => ({
                    key: ef.value,
                    label: ef.label.toUpperCase(),
                    icon: <EffortPill effort={ef.value} />,
                  })),
                ]}
                onSelect={(key) =>
                  updateTask(task.id, { effort: key ? (key as typeof task.effort) : undefined })
                }
              />
            </SidebarSection>

            <SidebarSection title="Project">
              <PropertySelect
                value={
                  project
                    ? {
                        key: project.id,
                        label: project.name,
                        icon: (
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: project.color }}
                          />
                        ),
                      }
                    : null
                }
                placeholder="No project"
                options={taskProjects.map((p) => ({
                  key: p.id,
                  label: p.name,
                  icon: (
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  ),
                }))}
                onSelect={(key) => updateTask(task.id, { projectId: key })}
              />
            </SidebarSection>

            <p className="px-2 text-xs text-[#5C626B]">Created {formatDate(task.createdAt)}</p>
          </div>

          <div className="p-3 border-t border-border">
            <button
              onClick={() => {
                removeTask(task.id);
                onClose();
              }}
              className="w-full py-2 text-sm font-medium text-red-400 bg-red-400/10 rounded-lg hover:bg-red-400/20 transition-colors cursor-pointer"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
