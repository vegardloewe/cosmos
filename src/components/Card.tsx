import type { BoardItem } from "../types";
import { useBoardStore } from "../stores/board-store";
import { CardImage } from "./CardImage";
import { CardLink } from "./CardLink";
import { CardText } from "./CardText";
import { CardVideo } from "./CardVideo";

interface CardProps {
  item: BoardItem;
}

function CardContent({ item }: CardProps) {
  switch (item.type) {
    case "image":
      return <CardImage item={item} />;
    case "video":
      return <CardVideo item={item} />;
    case "link":
      return <CardLink item={item} />;
    case "text":
      return <CardText item={item} />;
    default:
      return null;
  }
}

export function Card({ item }: CardProps) {
  const selectItem = useBoardStore((s) => s.selectItem);

  return (
    <div
      className="group relative bg-surface rounded-xl shadow-sm overflow-hidden transform-gpu cursor-pointer outline outline-0 hover:outline-3 outline-[#18191A] transition-all"
      onClick={() => selectItem(item.id)}
    >
      <CardContent item={item} />
    </div>
  );
}
