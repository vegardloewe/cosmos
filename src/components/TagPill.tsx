interface TagPillProps {
  tag: string;
  onRemove?: () => void;
}

export function TagPill({ tag, onRemove }: TagPillProps) {
  return (
    <span
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
      style={{ backgroundColor: `#18191A`, color: "#A8B4C6" }}
    >
      {tag}
      {onRemove && (
        <button onClick={onRemove} className="hover:opacity-70 cursor-pointer">
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </span>
  );
}
