import ReactMarkdown from "react-markdown";
import type { BoardItem } from "../types";

interface CardTextProps {
  item: BoardItem;
}

export function CardText({ item }: CardTextProps) {
  return (
    <div className="p-4 relative">
      {item.title && (
        <h3 className="text-md font-semibold text-[#FFFFFF] mb-1">
          {item.title}
        </h3>
      )}
      {item.excerpt && (
        <div className="text-sm text-[#A8B4C6] leading-relaxed line-clamp-6 prose-card">
          <ReactMarkdown>{item.excerpt}</ReactMarkdown>
        </div>
      )}
      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-surface to-transparent pointer-events-none" />
    </div>
  );
}
