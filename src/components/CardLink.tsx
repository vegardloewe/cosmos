import { useEffect, useState } from "react";
import { useBoardStore } from "../stores/board-store";
import { readThumbnail } from "../lib/tauri-commands";
import { useNearViewport } from "../hooks/use-near-viewport";
import type { BoardItem } from "../types";

interface CardLinkProps {
  item: BoardItem;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

export function CardLink({ item }: CardLinkProps) {
  const vaultPath = useBoardStore((s) => s.vaultPath);
  const { ref, near } = useNearViewport();
  const [thumbnailSrc, setThumbnailSrc] = useState<string | null>(null);

  // Deferred until the card is nearly in view; a failure just leaves the
  // placeholder below in place rather than retrying forever.
  useEffect(() => {
    if (!near || thumbnailSrc || !item.linkPreviewPath || !vaultPath) return;
    let cancelled = false;

    readThumbnail(vaultPath, item.linkPreviewPath)
      .then((src) => {
        if (!cancelled) setThumbnailSrc(src);
      })
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [near, thumbnailSrc, vaultPath, item.linkPreviewPath]);

  return (
    <div ref={ref} className="w-full text-left">
      {thumbnailSrc ? (
        <img
          src={thumbnailSrc}
          alt={item.linkTitle ?? ""}
          className="w-full object-cover"
        />
      ) : (
        <div className="w-full h-32 bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
          <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.04a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.34 8.798" />
          </svg>
        </div>
      )}
      <div className="p-3 flex flex-col gap-1">
        {item.linkTitle && (
          <p className="text-sm font-semibold text-text line-clamp-2">
            {item.linkTitle}
          </p>
        )}
        {item.url && (
          <p className="text-xs text-text-muted">{getDomain(item.url)}</p>
        )}
        {item.linkDescription && (
          <p className="text-xs text-text-muted line-clamp-2 mt-0.5">
            {item.linkDescription}
          </p>
        )}
      </div>
    </div>
  );
}
