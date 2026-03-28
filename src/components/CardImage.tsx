import { useEffect, useState } from "react";
import { useBoardStore } from "../stores/board-store";
import { readAsset } from "../lib/tauri-commands";
import type { BoardItem } from "../types";

interface CardImageProps {
  item: BoardItem;
}

export function CardImage({ item }: CardImageProps) {
  const vaultPath = useBoardStore((s) => s.vaultPath);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!item.assetPath || !vaultPath) return;
    readAsset(vaultPath, item.assetPath).then(setSrc).catch(console.error);
  }, [vaultPath, item.assetPath]);

  if (!src) return <div className="w-full h-48 bg-bg animate-pulse rounded-2xl" />;

  return (
    <img
      src={src}
      alt={item.title ?? ""}
      loading="lazy"
      className="w-full"
    />
  );
}
