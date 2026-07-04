import { useLayoutEffect, useRef, useState } from "react";
import { useBoardStore } from "../stores/board-store";
import type { AppMode } from "../stores/board-store";

const MODES: { label: string; value: AppMode }[] = [
  { label: "Shots", value: "moodboard" },
  { label: "Books", value: "books" },
  { label: "Goals", value: "goals" },
  { label: "Tasks", value: "tasks" },
];

export function ModeSwitch() {
  const appMode = useBoardStore((s) => s.appMode);
  const setAppMode = useBoardStore((s) => s.setAppMode);
  const buttonRefs = useRef<Partial<Record<AppMode, HTMLButtonElement | null>>>({});
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const btn = buttonRefs.current[appMode];
    if (btn) {
      setIndicator({ left: btn.offsetLeft, width: btn.offsetWidth });
    }
  }, [appMode]);

  return (
    <div className="relative flex items-center gap-0.5 bg-surface rounded-full p-1 shrink-0 z-10">
      {indicator && (
        <div
          className="absolute top-1 bottom-1 rounded-full bg-[#2A2B2D] transition-[left,width] duration-300 ease-[cubic-bezier(0.3,0.7,0.3,1)]"
          style={{ left: indicator.left, width: indicator.width }}
        />
      )}
      {MODES.map((mode) => (
        <button
          key={mode.value}
          ref={(el) => {
            buttonRefs.current[mode.value] = el;
          }}
          onClick={() => setAppMode(mode.value)}
          className={`relative px-3 py-1 rounded-full text-xs font-medium transition-colors duration-300 cursor-pointer ${
            appMode === mode.value ? "text-white" : "text-[#A8B4C6] hover:text-text"
          }`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
