import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { useBoardStore } from "../stores/board-store";
import { readAsset, readThumbnail } from "../lib/tauri-commands";
import { useNearViewport } from "../hooks/use-near-viewport";
import type { BoardItem } from "../types";

interface CardImageProps {
  item: BoardItem;
}

export function CardImage({ item }: CardImageProps) {
  const vaultPath = useBoardStore((s) => s.vaultPath);
  const { ref, near, visible } = useNearViewport();
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [animated, setAnimated] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const isGif = item.assetPath?.toLowerCase().endsWith(".gif") ?? false;

  useEffect(() => {
    setThumbnail(null);
    setAnimated(null);
    setFailed(false);
  }, [vaultPath, item.assetPath]);

  // Nothing is read from disk until the card is close to being seen, so opening
  // the app in another mode no longer pulls every image in the vault into memory.
  useEffect(() => {
    if (!near || thumbnail || failed || !item.assetPath || !vaultPath) return;
    let cancelled = false;

    readThumbnail(vaultPath, item.assetPath)
      .then((src) => {
        if (!cancelled) setThumbnail(src);
      })
      .catch((err) => {
        console.error(err);
        // Without this the skeleton below would pulse at 60fps forever.
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [near, thumbnail, failed, vaultPath, item.assetPath]);

  // A GIF's thumbnail is its first frame only. The animation is fetched while
  // the card is actually on screen and dropped again when it isn't, so a board
  // full of GIFs costs nothing once you scroll past them.
  useEffect(() => {
    if (!isGif || !visible || animated || !item.assetPath || !vaultPath) return;
    let cancelled = false;

    readAsset(vaultPath, item.assetPath)
      .then((src) => {
        if (!cancelled) setAnimated(src);
      })
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [isGif, visible, animated, vaultPath, item.assetPath]);

  useEffect(() => {
    if (!visible) setAnimated(null);
  }, [visible]);

  const src = isGif && visible && animated ? animated : thumbnail;
  // Reserving the real aspect ratio keeps the columns from reflowing as cards
  // load, which would otherwise shuffle what the observers think is on screen.
  const ratio =
    item.width && item.height ? `${item.width} / ${item.height}` : undefined;

  return (
    <div
      ref={ref}
      className={`w-full ${ratio ? "" : "min-h-48"}`}
      style={ratio ? { aspectRatio: ratio } : undefined}
    >
      {src ? (
        <img
          src={src}
          alt={item.title ?? ""}
          className="w-full h-full object-cover"
        />
      ) : failed ? (
        <div className="w-full h-full min-h-48 flex items-center justify-center bg-bg rounded-2xl">
          <ImageOff size={20} className="text-text-muted" />
        </div>
      ) : (
        <div className="w-full h-full min-h-48 bg-bg animate-pulse rounded-2xl" />
      )}
    </div>
  );
}
