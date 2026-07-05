import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import { useBoardStore } from "../stores/board-store";
import { TAG_COLORS } from "../lib/colors";
import { TaskModal } from "./TaskModal";

export function TasksToolbar() {
  const appMode = useBoardStore((s) => s.appMode);
  const taskProjects = useBoardStore((s) => s.taskProjects);
  const activeProjectId = useBoardStore((s) => s.activeProjectId);
  const setActiveProject = useBoardStore((s) => s.setActiveProject);
  const addTaskProject = useBoardStore((s) => s.addTaskProject);
  const removeTaskProject = useBoardStore((s) => s.removeTaskProject);

  const [showPicker, setShowPicker] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);

  const activeProject = taskProjects.find((p) => p.id === activeProjectId);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    if (showPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPicker]);

  const handleCreateProject = async () => {
    const name = newName.trim();
    if (!name) return;
    const color = TAG_COLORS[taskProjects.length % TAG_COLORS.length];
    await addTaskProject(name, color);
    setNewName("");
    setShowPicker(false);
  };

  return (
    <>
      <div
        data-tauri-drag-region
        className={`flex-1 items-center justify-end gap-2 relative z-10 ${
          appMode === "tasks" ? "flex" : "hidden"
        }`}
      >
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setShowPicker((v) => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] font-medium text-[#A8B4C6] hover:text-text hover:bg-[#0F1010] transition-colors cursor-pointer"
          >
            {activeProject ? (
              <>
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: activeProject.color }}
                />
                <span className="text-white">{activeProject.name}</span>
              </>
            ) : (
              <span>No project</span>
            )}
            <ChevronDown size={14} />
          </button>

          {showPicker && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-[#0F1010] border border-border rounded-xl shadow-2xl overflow-hidden">
              {taskProjects.map((project) => (
                <div
                  key={project.id}
                  className="group flex items-center hover:bg-[#18191A] transition-colors"
                >
                  <button
                    onClick={() => {
                      setActiveProject(project.id);
                      setShowPicker(false);
                    }}
                    className="flex-1 min-w-0 flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#A8B4C6] cursor-pointer text-left"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="flex-1 min-w-0 truncate">{project.name}</span>
                    {project.id === activeProjectId && (
                      <Check size={14} className="shrink-0 text-white" />
                    )}
                  </button>
                  <button
                    onClick={() => removeTaskProject(project.id)}
                    title="Delete project and its tasks"
                    className="pr-3 pl-1 py-2.5 text-text-muted opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}

              <div className={`flex items-center gap-2 px-3 py-2.5 ${taskProjects.length ? "border-t border-border" : ""}`}>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                  placeholder="New project..."
                  className="flex-1 min-w-0 bg-transparent text-sm text-text placeholder:text-text-muted outline-none"
                />
                <button
                  onClick={handleCreateProject}
                  disabled={!newName.trim()}
                  className="p-1 rounded-full text-[#A8B4C6] hover:text-text hover:bg-[#18191A] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          disabled={!activeProject}
          className="p-1.5 bg-transparent text-[#A8B4C6] rounded-full hover:text-text hover:bg-[#0F1010] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={18} strokeWidth={2} />
        </button>
      </div>

      {showAddModal && <TaskModal onClose={() => setShowAddModal(false)} />}
    </>
  );
}
