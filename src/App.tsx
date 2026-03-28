import { useEffect, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useBoardStore } from "./stores/board-store";
import { VaultPicker } from "./components/VaultPicker";
import { Board } from "./components/Board";
import { Toolbar } from "./components/Toolbar";
import { ItemDetail } from "./components/ItemDetail";
import "./styles/index.css";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"];
const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "mkv", "avi"];

function App() {
  const vaultPath = useBoardStore((s) => s.vaultPath);
  const isLoading = useBoardStore((s) => s.isLoading);
  const loadVault = useBoardStore((s) => s.loadVault);
  const addImage = useBoardStore((s) => s.addImage);
  const addImageData = useBoardStore((s) => s.addImageData);
  const addVideo = useBoardStore((s) => s.addVideo);
  const addVideoData = useBoardStore((s) => s.addVideoData);
  const addLink = useBoardStore((s) => s.addLink);
  const addNote = useBoardStore((s) => s.addNote);
  const selectedItemId = useBoardStore((s) => s.selectedItemId);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    loadVault();
  }, [loadVault]);

  useEffect(() => {
    if (!vaultPath) return;

    let unlisten: (() => void) | undefined;

    getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === "enter") {
          setIsDragging(true);
        } else if (event.payload.type === "leave") {
          setIsDragging(false);
        } else if (event.payload.type === "drop") {
          setIsDragging(false);
          const { paths } = event.payload;
          for (const path of paths) {
            const ext = path.split(".").pop()?.toLowerCase() ?? "";
            if (IMAGE_EXTENSIONS.includes(ext)) {
              addImage(path);
            } else if (VIDEO_EXTENSIONS.includes(ext)) {
              addVideo(path);
            }
          }
        }
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => {
      unlisten?.();
    };
  }, [vaultPath, addImage, addVideo]);

  // Paste handler: Cmd+V to paste images, links, or text
  useEffect(() => {
    if (!vaultPath) return;

    const handlePaste = async (e: ClipboardEvent) => {
      // Skip if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      const clipboard = e.clipboardData;
      if (!clipboard) return;

      // Check for image/video files first
      for (const item of Array.from(clipboard.items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (!blob) continue;
          const ext = item.type.split("/")[1] === "jpeg" ? "jpg" : item.type.split("/")[1] || "png";
          const buffer = await blob.arrayBuffer();
          const data = Array.from(new Uint8Array(buffer));
          addImageData(data, ext);
          return;
        }
        if (item.type.startsWith("video/")) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (!blob) continue;
          const ext = item.type.split("/")[1] || "mp4";
          const buffer = await blob.arrayBuffer();
          const data = Array.from(new Uint8Array(buffer));
          addVideoData(data, ext);
          return;
        }
      }

      // Check for text (URL or plain text)
      const text = clipboard.getData("text/plain")?.trim();
      if (!text) return;
      e.preventDefault();

      // Simple URL detection
      if (/^https?:\/\/.+/i.test(text)) {
        addLink(text);
      } else {
        // Treat as a text note
        const title = text.length > 50 ? text.slice(0, 50) + "..." : text;
        addNote(title, text);
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [vaultPath, addImageData, addVideoData, addLink, addNote]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg">
        <img src="/cosmos-icon.png" alt="Cosmos" className="w-16 h-16 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!vaultPath) {
    return <VaultPicker />;
  }

  return (
    <div className="h-screen flex flex-col relative">
      <Toolbar />
      <Board />
      {selectedItemId && <ItemDetail />}

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center bg-white/10 border-4 border-dashed border-white rounded-xl pointer-events-none">
          <div className="bg-surface px-8 py-4 rounded-2xl shadow-lg">
            <p className="text-lg font-semibold text-white">
              Drop files to add
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
