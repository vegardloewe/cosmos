import type { TaskEffort, TaskPriority, TaskStatus } from "../types";

export const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
];

export const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export const EFFORTS: { value: TaskEffort; label: string }[] = [
  { value: "s", label: "S" },
  { value: "m", label: "M" },
  { value: "l", label: "L" },
  { value: "xl", label: "XL" },
];

// Linear-style status dots: dashed → empty → half-filled → checked circle
export function StatusIcon({ status, size = 14 }: { status: TaskStatus; size?: number }) {
  if (status === "backlog") {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" className="shrink-0">
        <circle
          cx="7" cy="7" r="5.5"
          fill="none" stroke="#5C626B" strokeWidth="1.5"
          strokeDasharray="1.8 1.8"
        />
      </svg>
    );
  }
  if (status === "todo") {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" className="shrink-0">
        <circle cx="7" cy="7" r="5.5" fill="none" stroke="#8A8F98" strokeWidth="1.5" />
      </svg>
    );
  }
  if (status === "in_progress") {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" className="shrink-0">
        <circle cx="7" cy="7" r="5.5" fill="none" stroke="#F2C94C" strokeWidth="1.5" />
        {/* Half-pie fill */}
        <path d="M 7 3.5 A 3.5 3.5 0 0 1 7 10.5 Z" fill="#F2C94C" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" className="shrink-0">
      <circle cx="7" cy="7" r="6" fill="#6E79D6" />
      <path
        d="M 4.2 7.2 L 6.2 9.2 L 9.8 5.2"
        fill="none" stroke="#0F1010" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

// Linear-style priority: orange "!" square for urgent, signal bars for the rest
export function PriorityIcon({ priority, size = 14 }: { priority?: TaskPriority; size?: number }) {
  if (priority === "urgent") {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" className="shrink-0">
        <rect x="0.5" y="0.5" width="13" height="13" rx="3.5" fill="#F2994A" />
        <rect x="6.25" y="3" width="1.5" height="5" rx="0.75" fill="#0F1010" />
        <rect x="6.25" y="9.25" width="1.5" height="1.5" rx="0.75" fill="#0F1010" />
      </svg>
    );
  }
  const filled = priority === "high" ? 3 : priority === "medium" ? 2 : priority === "low" ? 1 : 0;
  const bars = [
    { x: 1.5, y: 8, h: 4 },
    { x: 6, y: 5.5, h: 6.5 },
    { x: 10.5, y: 3, h: 9 },
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" className="shrink-0">
      {bars.map((bar, i) => (
        <rect
          key={i}
          x={bar.x} y={bar.y} width="2.5" height={bar.h} rx="1"
          fill={i < filled ? "#A8B4C6" : "#3A3D42"}
        />
      ))}
    </svg>
  );
}

export function EffortPill({ effort }: { effort: TaskEffort }) {
  return (
    <span className="px-1.5 py-px rounded border border-border text-[10px] font-medium uppercase text-text-muted leading-4">
      {effort}
    </span>
  );
}
