import { useEffect, useRef, useState } from "react";
import { useBoardStore } from "../stores/board-store";
import { readAssetBytes } from "../lib/tauri-commands";
import { useNearViewport } from "../hooks/use-near-viewport";
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
  // The board stays mounted behind `display: none` when another mode is open
  // (see App.tsx), and WebKit keeps decoding a hidden <video> — it only stops
  // painting it. So playback is gated on the mode as well as on visibility.
  const boardVisible = useBoardStore((s) => s.appMode === "moodboard");
  const { ref, near, visible } = useNearViewport();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const shouldPlay = boardVisible && visible;

  useEffect(() => {
    setSrc(null);
    setFailed(false);
  }, [vaultPath, item.assetPath]);

  // Bytes are only pulled once the card is about to be seen, and the blob is
  // kept afterwards so scrolling back doesn't re-read from disk.
  useEffect(() => {
    if (!boardVisible || !near) return;
    if (src || failed || !item.assetPath || !vaultPath) return;
    let cancelled = false;

    readAssetBytes(vaultPath, item.assetPath)
      .then((buffer) => {
        if (cancelled) return;
        const ext = item.assetPath?.split(".").pop()?.toLowerCase() || "mp4";
        const mime = mimeForExt[ext] || "video/mp4";
        const blob = new Blob([buffer], { type: mime });
        setSrc(URL.createObjectURL(blob));
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [boardVisible, near, src, failed, vaultPath, item.assetPath]);

  useEffect(() => {
    return () => {
      if (src) URL.revokeObjectURL(src);
    };
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    if (shouldPlay) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [shouldPlay, src]);

  const ratio =
    item.width && item.height ? `${item.width} / ${item.height}` : undefined;

  return (
    <div
      ref={ref}
      className={`w-full ${ratio ? "" : "min-h-48"}`}
      style={ratio ? { aspectRatio: ratio } : undefined}
    >
      {src ? (
        <video
          ref={videoRef}
          src={src}
          muted
          loop
          playsInline
          preload="metadata"
          className="w-full h-full object-cover"
        />
      ) : (
        <div
          className={`w-full h-full min-h-48 rounded-2xl bg-bg ${
            failed ? "" : "animate-pulse"
          }`}
        />
      )}
    </div>
  );
}
