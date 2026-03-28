import { useEffect, useState } from "react";
import { useBoardStore } from "../stores/board-store";
import { readAssetBytes } from "../lib/tauri-commands";
import type { BoardItem } from "../types";

interface CardVideoProps {
  item: BoardItem;
}

const mimeForExt: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
};

export function CardVideo({ item }: CardVideoProps) {
  const vaultPath = useBoardStore((s) => s.vaultPath);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!item.assetPath || !vaultPath) return;
    let revoked = false;
    let blobUrl: string | null = null;

    readAssetBytes(vaultPath, item.assetPath).then((buffer) => {
      if (revoked) return;
      const ext = item.assetPath?.split(".").pop()?.toLowerCase() || "mp4";
      const mime = mimeForExt[ext] || "video/mp4";
      const blob = new Blob([buffer], { type: mime });
      blobUrl = URL.createObjectURL(blob);
      setSrc(blobUrl);
    }).catch(console.error);

    return () => {
      revoked = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [vaultPath, item.assetPath]);

  if (!src) return <div className="w-full h-48 bg-bg animate-pulse rounded-2xl" />;

  return (
    <video
      src={src}
      muted
      loop
      autoPlay
      playsInline
      className="w-full"
    />
  );
}
