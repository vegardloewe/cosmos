import { useMemo } from "react";
import { useFilteredItems } from "../stores/board-store";
import { Card } from "./Card";
import { useColumnCount } from "../hooks/use-column-count";

export function Board() {
  const items = useFilteredItems();
  const columnCount = useColumnCount();

  const columns = useMemo(() => {
    const cols: typeof items[] = Array.from({ length: columnCount }, () => []);
    items.forEach((item, i) => {
      cols[i % columnCount].push(item);
    });
    return cols;
  }, [items, columnCount]);

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <svg className="w-16 h-16 text-border" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
          </svg>
          <p className="text-text-muted text-sm">
            Drop images, paste links, or write notes to get started
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex gap-4">
        {columns.map((col, colIndex) => (
          <div key={colIndex} className="flex-1 flex flex-col gap-4">
            {col.map((item) => (
              <Card key={item.id} item={item} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
