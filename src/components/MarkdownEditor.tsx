import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import { openUrl } from "@tauri-apps/plugin-opener";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  autoFocus?: boolean;
}

const toolbarButtonClass =
  "w-8 h-8 flex items-center justify-center rounded-lg text-[#9ca3af] hover:text-white hover:bg-white/10 transition-colors cursor-pointer";

export function MarkdownEditor({
  value,
  onChange,
  onBlur,
  placeholder,
  rows = 8,
  className = "",
  autoFocus = false,
}: MarkdownEditorProps) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const linkInputRef = useRef<HTMLInputElement>(null);
  const showLinkInputRef = useRef(setShowLinkInput);
  showLinkInputRef.current = setShowLinkInput;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Markdown,
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: value,
    contentType: "markdown",
    autofocus: autoFocus ? "end" : false,
    onUpdate: ({ editor }) => onChange(editor.getMarkdown()),
    onBlur: () => onBlur?.(),
    editorProps: {
      attributes: {
        class: `prose-card outline-none ${className}`,
        style: `min-height: ${rows * 1.5}em`,
      },
      handleKeyDown: (view, event) => {
        // Cmd+K → link input (needs a selection for the bubble to anchor to)
        if ((event.metaKey || event.ctrlKey) && event.key === "k") {
          event.preventDefault();
          if (!view.state.selection.empty) {
            showLinkInputRef.current(true);
            setTimeout(() => linkInputRef.current?.focus(), 0);
          }
          return true;
        }
        return false;
      },
    },
  });

  // External value changes (task switch, save round-trip) re-render the doc;
  // content the editor itself just emitted is already in sync and skipped
  useEffect(() => {
    if (!editor || value === editor.getMarkdown()) return;
    editor.commands.setContent(value, { contentType: "markdown", emitUpdate: false });
  }, [value, editor]);

  // Links open in the system browser instead of navigating the webview
  const handleClick = (e: React.MouseEvent) => {
    const anchor = (e.target as HTMLElement).closest("a");
    if (anchor) {
      e.preventDefault();
      const href = anchor.getAttribute("href");
      if (href) openUrl(href);
    }
  };

  const closeLinkInput = () => {
    setShowLinkInput(false);
    setLinkUrl("");
  };

  const applyLink = () => {
    const href = linkUrl.trim();
    closeLinkInput();
    if (!editor || !href) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  };

  const format = (action: () => void) => {
    action();
    setShowLinkInput(false);
  };

  return (
    <div className="relative w-full" onClick={handleClick}>
      <EditorContent editor={editor} />

      {editor && (
        <BubbleMenu
          editor={editor}
          options={{ placement: "top", offset: 8 }}
          className="flex items-center gap-0.5 px-1.5 py-1.5 bg-[#2a2b2e] rounded-xl shadow-lg border border-white/10"
        >
          {showLinkInput ? (
            <input
              ref={linkInputRef}
              autoFocus
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyLink();
                }
                if (e.key === "Escape") {
                  closeLinkInput();
                  editor.commands.focus();
                }
              }}
              onBlur={closeLinkInput}
              placeholder="https://your.link"
              className="w-56 px-1.5 bg-transparent text-sm text-[#A8B4C6] placeholder:text-[#5C626B] outline-none"
            />
          ) : (
            // preventDefault keeps the editor selection (and the bubble) alive
            <div className="flex items-center gap-0.5" onMouseDown={(e) => e.preventDefault()}>
              <button
                onClick={() => format(() => editor.chain().focus().toggleBold().run())}
                title="Bold"
                className={toolbarButtonClass}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M5 4h7.5a4.5 4.5 0 0 1 3.256 7.606A5 5 0 0 1 13 22H5V4Zm2 2v5h5.5a2.5 2.5 0 0 0 0-5H7Zm0 7v5h6a3 3 0 0 0 0-6H7Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              <button
                onClick={() => format(() => editor.chain().focus().toggleItalic().run())}
                title="Italic"
                className={toolbarButtonClass}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M10 5h6M8 19h6M14.5 5l-5 14"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              <button
                onClick={() => format(() => editor.chain().focus().toggleTaskList().run())}
                title="Checklist"
                className={toolbarButtonClass}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m9 11 3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
              </button>
              <button
                onClick={() => {
                  setShowLinkInput(true);
                  setLinkUrl("");
                  setTimeout(() => linkInputRef.current?.focus(), 0);
                }}
                title="Link"
                className={toolbarButtonClass}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </button>
              <button
                onClick={() => format(() => editor.chain().focus().toggleStrike().run())}
                title="Strikethrough"
                className={toolbarButtonClass}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M16 4H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H8" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                </svg>
              </button>
            </div>
          )}
        </BubbleMenu>
      )}
    </div>
  );
}
