import { useEffect, useRef, useState } from "react";
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
  // The board stays mounted behind `display: none` when another mode is open
  // (see App.tsx), and WebKit keeps decoding a hidden <video> — it only stops
  // painting it. So playback is gated on the mode as well as on visibility.
  const boardVisible = useBoardStore((s) => s.appMode === "moodboard");
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [onScreen, setOnScreen] = useState(false);
  const [src, setSrc] = useState<string | null>(null);

  const active = boardVisible && onScreen;

  // Cards scrolled out of the viewport (and every card of a hidden board)
  // report as not intersecting, which is what pauses them.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Bytes are only pulled once the card is actually about to be seen, and the
  // blob is kept afterwards so scrolling back doesn't re-read from disk.
  useEffect(() => {
    if (!active || src || !item.assetPath || !vaultPath) return;
    let cancelled = false;

    readAssetBytes(vaultPath, item.assetPath).then((buffer) => {
      if (cancelled) return;
      const ext = item.assetPath?.split(".").pop()?.toLowerCase() || "mp4";
      const mime = mimeForExt[ext] || "video/mp4";
      const blob = new Blob([buffer], { type: mime });
      setSrc(URL.createObjectURL(blob));
    }).catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [active, src, vaultPath, item.assetPath]);

  useEffect(() => {
    setSrc(null);
  }, [vaultPath, item.assetPath]);

  useEffect(() => {
    return () => {
      if (src) URL.revokeObjectURL(src);
    };
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    if (active) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [active, src]);

  return (
    <div ref={containerRef} className="w-full">
      {src ? (
        <video
          ref={videoRef}
          src={src}
          muted
          loop
          playsInline
          preload="metadata"
          className="w-full"
        />
      ) : (
        <div className="w-full h-48 bg-bg rounded-2xl" />
      )}
    </div>
  );
}
