import { useEffect, useMemo, useRef, useState } from "react";
import { KanbanSquare, Plus } from "lucide-react";
import { useBoardStore } from "../stores/board-store";
import { TAG_COLORS } from "../lib/colors";
import { TaskModal } from "./TaskModal";
import { TaskDetail } from "./TaskDetail";
import { DeadlineBadge, EffortPill, isOverdue, PriorityIcon, STATUSES, StatusIcon } from "./task-meta";
import { Button } from "@/components/ui/button";
import type { Task, TaskPriority, TaskStatus } from "../types";

// List view groups active work first; the board keeps left-to-right workflow order
const LIST_STATUS_ORDER: TaskStatus[] = ["in_progress", "todo", "backlog", "done"];

// Linear's list ordering: urgent first, unset priority last
const PRIORITY_RANK: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function byPriority(a: Task, b: Task): number {
  const rankA = a.priority ? PRIORITY_RANK[a.priority] : 4;
  const rankB = b.priority ? PRIORITY_RANK[b.priority] : 4;
  return rankA - rankB;
}

function formatDate(millis: string): string {
  return new Date(Number(millis)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function completedToday(task: Task): boolean {
  if (!task.completedAt) return false;
  const done = new Date(Number(task.completedAt));
  const now = new Date();
  return (
    done.getFullYear() === now.getFullYear() &&
    done.getMonth() === now.getMonth() &&
    done.getDate() === now.getDate()
  );
}

// Right-click menu shared by board cards and list rows
function useTaskMenu(task: Task, onEdit: (task: Task) => void) {
  const removeTask = useBoardStore((s) => s.removeTask);
  const transferTaskToNote = useBoardStore((s) => s.transferTaskToNote);
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

  const openMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  const menuElement = menu && (
    <div
      ref={menuRef}
      className="fixed z-[200] w-40 bg-[#0F1010] border border-border rounded-xl shadow-2xl overflow-hidden"
      style={{ left: menu.x, top: menu.y }}
    >
      <button
        onClick={() => {
          setMenu(null);
          onEdit(task);
        }}
        className="w-full px-4 py-2.5 text-sm text-[#A8B4C6] hover:bg-[#18191A] transition-colors cursor-pointer text-left"
      >
        Edit
      </button>
      <button
        onClick={() => {
          setMenu(null);
          transferTaskToNote(task.id);
        }}
        className="w-full px-4 py-2.5 text-sm text-[#A8B4C6] hover:bg-[#18191A] transition-colors cursor-pointer text-left"
      >
        Turn into note
      </button>
      <button
        onClick={() => {
          setMenu(null);
          removeTask(task.id);
        }}
        className="w-full px-4 py-2.5 text-sm text-red-400 hover:bg-[#18191A] transition-colors cursor-pointer text-left"
      >
        Delete
      </button>
    </div>
  );

  return { openMenu, menuElement };
}

function TaskCard({ task, onEdit }: { task: Task; onEdit: (task: Task) => void }) {
  const { openMenu, menuElement } = useTaskMenu(task, onEdit);

  return (
    <>
      <div
        onClick={() => onEdit(task)}
        onContextMenu={openMenu}
        className="bg-surface border border-border rounded-lg p-3 flex flex-col gap-2 cursor-pointer hover:border-[#3A3D42] transition-colors select-none"
      >
        <p className="text-[13px] font-medium text-text leading-snug">{task.title}</p>
        {(task.priority || task.effort || task.deadline) && (
          <div className="flex items-center gap-2">
            {task.priority && <PriorityIcon priority={task.priority} />}
            {task.effort && <EffortPill effort={task.effort} />}
            {task.deadline && (
              <DeadlineBadge deadline={task.deadline} overdue={isOverdue(task)} />
            )}
          </div>
        )}
      </div>
      {menuElement}
    </>
  );
}

function TaskRow({ task, onEdit }: { task: Task; onEdit: (task: Task) => void }) {
  const { openMenu, menuElement } = useTaskMenu(task, onEdit);

  return (
    <>
      <div
        onClick={() => onEdit(task)}
        onContextMenu={openMenu}
        className="flex items-center gap-3 pl-8 pr-4 py-2 cursor-pointer hover:bg-[#0F1010] transition-colors select-none"
      >
        <PriorityIcon priority={task.priority} />
        <StatusIcon status={task.status} />
        <span className="flex-1 min-w-0 truncate text-[13px] font-medium text-text">
          {task.title}
        </span>
        {task.deadline && (
          <DeadlineBadge deadline={task.deadline} overdue={isOverdue(task)} />
        )}
        {task.effort && <EffortPill effort={task.effort} />}
        <span className="w-12 text-right text-xs text-text-muted tabular-nums shrink-0">
          {formatDate(task.createdAt)}
        </span>
      </div>
      {menuElement}
    </>
  );
}

export function TasksView() {
  const tasks = useBoardStore((s) => s.tasks);
  const taskProjects = useBoardStore((s) => s.taskProjects);
  const activeProjectId = useBoardStore((s) => s.activeProjectId);
  const addTaskProject = useBoardStore((s) => s.addTaskProject);
  const moveTask = useBoardStore((s) => s.moveTask);
  const moveTaskToStatus = useBoardStore((s) => s.moveTaskToStatus);
  const persistTaskDrag = useBoardStore((s) => s.persistTaskDrag);
  const tasksViewMode = useBoardStore((s) => s.tasksViewMode);

  const [dragId, setDragId] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [addingToStatus, setAddingToStatus] = useState<TaskStatus | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [showOldTasks, setShowOldTasks] = useState(false);

  const projectTasks = useMemo(
    () => tasks.filter((t) => t.projectId === activeProjectId),
    [tasks, activeProjectId],
  );

  // Array order is the display order within each column (drag & drop reorders it)
  // Done only shows today's completions unless "Show old tasks" is on
  const columns = useMemo(
    () =>
      STATUSES.map((status) => {
        const all = projectTasks.filter((t) => t.status === status.value);
        if (status.value !== "done") return { ...status, tasks: all, oldCount: 0 };
        const oldCount = all.filter((t) => !completedToday(t)).length;
        return {
          ...status,
          tasks: showOldTasks ? all : all.filter(completedToday),
          oldCount,
        };
      }),
    [projectTasks, showOldTasks],
  );

  const startDrag = (id: string) => {
    // A stale drag can linger if the previous one ended without an event
    // (e.g. cancelled after crossing columns) — settle it before starting anew
    finalizeDrag();
    dragIdRef.current = id;
    setDragId(id);
  };

  const finalizeDrag = () => {
    const id = dragIdRef.current;
    if (!id) return;
    dragIdRef.current = null;
    setDragId(null);
    persistTaskDrag(id);
  };

  // Moving a card to another column remounts its DOM node, so dragend never
  // fires on the card itself — catch the end of the drag at the document level
  useEffect(() => {
    if (!dragId) return;
    document.addEventListener("dragend", finalizeDrag);
    document.addEventListener("drop", finalizeDrag);
    return () => {
      document.removeEventListener("dragend", finalizeDrag);
      document.removeEventListener("drop", finalizeDrag);
    };
  }, [dragId]);

  if (taskProjects.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <KanbanSquare size={64} strokeWidth={1} className="text-border" />
          <p className="text-text-muted text-sm">
            Create a project to start tracking tasks
          </p>
          <div className="flex items-center gap-2 w-full">
            <input
              autoFocus
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newProjectName.trim()) {
                  addTaskProject(newProjectName.trim(), TAG_COLORS[0]);
                  setNewProjectName("");
                }
              }}
              placeholder="Project name (e.g. Side projects)"
              className="flex-1 min-w-0 px-4 py-2.5 bg-surface rounded-xl text-sm text-text placeholder:text-text-muted outline-none focus:ring-2 focus:ring-white/20"
            />
            <Button
              onClick={() => {
                if (!newProjectName.trim()) return;
                addTaskProject(newProjectName.trim(), TAG_COLORS[0]);
                setNewProjectName("");
              }}
              disabled={!newProjectName.trim()}
            >
              Create
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (tasksViewMode === "list") {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        {LIST_STATUS_ORDER.map((status) => {
          const column = columns.find((c) => c.value === status)!;
          // Like Linear, empty groups are hidden (unless Done has hidden old tasks)
          if (column.tasks.length === 0 && column.oldCount === 0) return null;
          const sorted = [...column.tasks].sort(byPriority);
          return (
            <div key={column.value} className="mb-1">
              <div className="sticky top-0 z-10 bg-bg pt-2 pb-1">
                <div className="flex items-center gap-2 px-3 py-2 bg-[#0B0C0C] rounded-lg">
                  <StatusIcon status={column.value} />
                  <span className="text-[13px] font-medium text-text">{column.label}</span>
                  <span className="text-xs text-text-muted tabular-nums">{sorted.length}</span>
                  <button
                    onClick={() => setAddingToStatus(column.value)}
                    title={`Add to ${column.label}`}
                    className="ml-auto p-1 rounded text-text-muted hover:text-text hover:bg-surface transition-colors cursor-pointer"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {sorted.map((task) => (
                <TaskRow key={task.id} task={task} onEdit={setEditingTask} />
              ))}

              {column.value === "done" && column.oldCount > 0 && (
                <button
                  onClick={() => setShowOldTasks((v) => !v)}
                  className="mt-1 ml-8 px-2 py-1.5 rounded-md text-xs text-text-muted hover:text-text hover:bg-surface transition-colors cursor-pointer text-left"
                >
                  {showOldTasks
                    ? "Hide old tasks"
                    : `Show old tasks (${column.oldCount})`}
                </button>
              )}
            </div>
          );
        })}

        {editingTask && (
          <TaskDetail taskId={editingTask.id} onClose={() => setEditingTask(null)} />
        )}
        {addingToStatus && (
          <TaskModal initialStatus={addingToStatus} onClose={() => setAddingToStatus(null)} />
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 p-4">
      <div className="flex gap-3 h-full">
        {columns.map((column) => (
          <div
            key={column.value}
            className="flex-1 min-w-0 flex flex-col bg-[#0B0C0C] rounded-xl"
            onDragOver={(e) => {
              e.preventDefault();
              // Dragging over empty column space moves the task to the end of this column
              if (dragId) moveTaskToStatus(dragId, column.value);
            }}
            onDrop={(e) => e.preventDefault()}
          >
            <div className="flex items-center gap-2 px-3 pt-3 pb-2 shrink-0">
              <StatusIcon status={column.value} />
              <span className="text-[13px] font-medium text-text">{column.label}</span>
              <span className="text-xs text-text-muted tabular-nums">
                {column.tasks.length}
              </span>
              <button
                onClick={() => setAddingToStatus(column.value)}
                title={`Add to ${column.label}`}
                className="ml-auto p-1 rounded text-text-muted hover:text-text hover:bg-surface transition-colors cursor-pointer"
              >
                <Plus size={14} />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 px-2 pb-2">
              {column.tasks.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => {
                    startDrag(task.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    // Keep the column-level handler from bouncing the card to the end
                    e.stopPropagation();
                    if (dragId && dragId !== task.id) moveTask(dragId, task.id);
                  }}
                  className={`transition-opacity ${dragId === task.id ? "opacity-40" : ""}`}
                >
                  <TaskCard task={task} onEdit={setEditingTask} />
                </div>
              ))}

              {column.value === "done" && column.oldCount > 0 && (
                <button
                  onClick={() => setShowOldTasks((v) => !v)}
                  className="mt-1 px-2 py-1.5 rounded-md text-xs text-text-muted hover:text-text hover:bg-surface transition-colors cursor-pointer text-left"
                >
                  {showOldTasks
                    ? "Hide old tasks"
                    : `Show old tasks (${column.oldCount})`}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {editingTask && (
        <TaskDetail taskId={editingTask.id} onClose={() => setEditingTask(null)} />
      )}
      {addingToStatus && (
        <TaskModal initialStatus={addingToStatus} onClose={() => setAddingToStatus(null)} />
      )}
    </div>
  );
}
