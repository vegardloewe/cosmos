import { useRef, useState, useCallback, useEffect } from "react";
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

type FormatAction = "bold" | "italic" | "strikethrough" | "checklist" | "link";

/* ── Markdown → HTML ────────────────────────────────────── */

function inlineMd(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>")
    .replace(/~~(.+?)~~/g, "<del>$1</del>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function mdToHtml(md: string): string {
  if (!md) return "";

  const blocks = md.split(/\n{2,}/);
  return blocks
    .map((block) => {
      const lines = block.split("\n");

      // List block: every line starts with "- "
      if (lines.length > 0 && lines.every((l) => l.match(/^- /))) {
        const items = lines.map((l) => {
          const content = l.slice(2);
          if (content.startsWith("[ ] "))
            return `<li><input type="checkbox" />${inlineMd(content.slice(4))}</li>`;
          if (content.startsWith("[x] "))
            return `<li><input type="checkbox" checked />${inlineMd(content.slice(4))}</li>`;
          return `<li>${inlineMd(content)}</li>`;
        });
        return `<ul>${items.join("")}</ul>`;
      }

      // Heading (single-line block)
      if (lines.length === 1) {
        const line = lines[0];
        if (line.startsWith("### "))
          return `<h3>${inlineMd(line.slice(4))}</h3>`;
        if (line.startsWith("## "))
          return `<h2>${inlineMd(line.slice(3))}</h2>`;
        if (line.startsWith("# "))
          return `<h1>${inlineMd(line.slice(2))}</h1>`;
        if (line.startsWith("> "))
          return `<blockquote><p>${inlineMd(line.slice(2))}</p></blockquote>`;
      }

      return `<p>${inlineMd(block.replace(/\n/g, "<br>"))}</p>`;
    })
    .join("");
}

/* ── HTML → Markdown ────────────────────────────────────── */

function htmlToMd(el: HTMLElement): string {
  let result = "";

  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent || "";
      continue;
    }

    const child = node as HTMLElement;
    const tag = child.tagName;

    // Skip checkbox inputs — handled by LI case
    if (tag === "INPUT") continue;

    const inner = htmlToMd(child);

    switch (tag) {
      case "STRONG":
      case "B":
        result += `**${inner}**`;
        break;
      case "EM":
      case "I":
        result += `*${inner}*`;
        break;
      case "DEL":
      case "S":
        result += `~~${inner}~~`;
        break;
      case "H1":
        result += `# ${inner}\n\n`;
        break;
      case "H2":
        result += `## ${inner}\n\n`;
        break;
      case "H3":
        result += `### ${inner}\n\n`;
        break;
      case "P":
        result += `${inner}\n\n`;
        break;
      case "BR":
        result += "\n";
        break;
      case "UL":
      case "OL":
        result += inner;
        break;
      case "LI": {
        const checkbox = child.querySelector(
          'input[type="checkbox"]',
        ) as HTMLInputElement | null;
        if (checkbox) {
          const checked = checkbox.checked;
          const text = Array.from(child.childNodes)
            .filter((n) => !(n instanceof HTMLInputElement))
            .map((n) =>
              n.nodeType === Node.TEXT_NODE
                ? n.textContent
                : htmlToMd(n as HTMLElement),
            )
            .join("");
          result += `- [${checked ? "x" : " "}] ${text.trim()}\n`;
        } else {
          result += `- ${inner}\n`;
        }
        break;
      }
      case "BLOCKQUOTE":
        result += `> ${inner.replace(/\n+$/, "").trim()}\n\n`;
        break;
      case "CODE":
        result += `\`${inner}\``;
        break;
      case "A": {
        const href = child.getAttribute("href") || "";
        result += `[${inner}](${href})`;
        break;
      }
      case "DIV":
        // Browsers sometimes wrap lines in divs
        result += `${inner}\n`;
        break;
      default:
        result += inner;
    }
  }

  return result;
}

/* ── Component ──────────────────────────────────────────── */

export function MarkdownEditor({
  value,
  onChange,
  onBlur,
  placeholder,
  rows = 8,
  className = "",
  autoFocus = false,
}: MarkdownEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPos, setToolbarPos] = useState({ top: 0, left: 0 });
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const savedSelection = useRef<Range | null>(null);
  const isInternalChange = useRef(false);

  // Render markdown → HTML on mount and external value changes
  useEffect(() => {
    if (!editorRef.current) return;
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    editorRef.current.innerHTML = mdToHtml(value) || "<p><br></p>";
  }, [value]);

  // Auto-focus
  useEffect(() => {
    if (autoFocus && editorRef.current) {
      editorRef.current.focus();
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [autoFocus]);

  // A caret can't render inside an element that only contains an <input>,
  // so freshly created checkboxes get a zero-width space to anchor it.
  // The ZWSP is stripped back out when serializing to markdown.
  const makeCheckbox = (): [HTMLInputElement, Text] => {
    const cb = document.createElement("input");
    cb.type = "checkbox";
    return [cb, document.createTextNode("\u200B")];
  };

  // On every edit, convert HTML → markdown and notify parent
  const syncToMarkdown = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const md = htmlToMd(el).replace(/\u200B/g, "").replace(/\n{3,}/g, "\n\n").trim();
    isInternalChange.current = true;
    onChange(md);
  }, [onChange]);

  const handleInput = useCallback(() => {
    syncToMarkdown();
  }, [syncToMarkdown]);

  // Paste as plain text — the default would inject the source page's HTML
  // (colors, fonts) straight into the editor
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      if (!text) return;
      document.execCommand("insertText", false, text);
      syncToMarkdown();
    },
    [syncToMarkdown],
  );

  /* ── Notion-style block shortcuts (typed at line start + space) ── */

  // "# " → heading, "- " → list, "[] " → checkbox, "> " → quote.
  // Returns true if a transform happened (the caller swallows the space).
  const applyBlockShortcut = (): boolean => {
    const editor = editorRef.current;
    const sel = window.getSelection();
    if (!editor || !sel || !sel.isCollapsed || !sel.anchorNode) return false;
    if (!editor.contains(sel.anchorNode)) return false;

    const range = sel.getRangeAt(0);
    const container = range.startContainer;
    const el =
      container.nodeType === Node.TEXT_NODE
        ? container.parentElement
        : (container as HTMLElement);
    const block = el?.closest("p, div, h1, h2, h3, li, blockquote") as HTMLElement | null;
    if (!block || block === editor || !editor.contains(block)) return false;

    // Text between the start of the block and the caret — the would-be marker
    const preRange = document.createRange();
    preRange.selectNodeContents(block);
    preRange.setEnd(range.startContainer, range.startOffset);
    const marker = preRange.toString();

    const setCaret = (target: Node, offset = 0) => {
      const r = document.createRange();
      r.setStart(target, offset);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
    };

    // Inside a list item: "[]" turns it into a checklist item
    if (block.tagName === "LI") {
      if (
        (marker === "[]" || marker === "[ ]") &&
        !block.querySelector('input[type="checkbox"]')
      ) {
        preRange.deleteContents();
        const [cb, anchor] = makeCheckbox();
        block.insertBefore(cb, block.firstChild);
        cb.after(anchor);
        setCaret(anchor, 1);
        syncToMarkdown();
        return true;
      }
      return false;
    }

    if (block.tagName !== "P" && block.tagName !== "DIV") return false;

    const moveContentInto = (target: HTMLElement) => {
      while (block.firstChild) target.appendChild(block.firstChild);
      if (!target.textContent && !target.querySelector("br")) {
        target.innerHTML = "<br>";
      }
    };

    if (/^#{1,3}$/.test(marker)) {
      preRange.deleteContents();
      const heading = document.createElement(`h${marker.length}`);
      moveContentInto(heading);
      block.replaceWith(heading);
      setCaret(heading, 0);
      syncToMarkdown();
      return true;
    }

    if (marker === "-" || marker === "*" || marker === "[]" || marker === "[ ]" || marker === "-[]" || marker === "-[ ]") {
      const isChecklist = marker.includes("[");
      preRange.deleteContents();
      const ul = document.createElement("ul");
      const li = document.createElement("li");
      ul.appendChild(li);
      moveContentInto(li);
      let anchor: Text | null = null;
      if (isChecklist) {
        const [cb, zwsp] = makeCheckbox();
        anchor = zwsp;
        li.insertBefore(zwsp, li.firstChild);
        li.insertBefore(cb, zwsp);
      }
      block.replaceWith(ul);
      if (anchor) setCaret(anchor, 1);
      else setCaret(li, 0);
      syncToMarkdown();
      return true;
    }

    if (marker === ">") {
      preRange.deleteContents();
      const quote = document.createElement("blockquote");
      const p = document.createElement("p");
      quote.appendChild(p);
      moveContentInto(p);
      block.replaceWith(quote);
      setCaret(p, 0);
      syncToMarkdown();
      return true;
    }

    return false;
  };

  /* ── Keyboard shortcuts ─────────────────────────────── */

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === " " && applyBlockShortcut()) {
      e.preventDefault();
      return;
    }

    // Cmd+B → bold
    if ((e.metaKey || e.ctrlKey) && e.key === "b") {
      e.preventDefault();
      document.execCommand("bold");
      syncToMarkdown();
      return;
    }
    // Cmd+I → italic
    if ((e.metaKey || e.ctrlKey) && e.key === "i") {
      e.preventDefault();
      document.execCommand("italic");
      syncToMarkdown();
      return;
    }
    // Cmd+K → link
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      handleFormat("link");
      return;
    }

    // Backspace at start of a list item → unwrap to paragraph
    if (e.key === "Backspace") {
      const sel = window.getSelection();
      if (sel?.anchorNode && sel.isCollapsed) {
        const li =
          (sel.anchorNode as HTMLElement).closest?.("li") ||
          sel.anchorNode.parentElement?.closest("li");
        if (li) {
          // Check if cursor is at the very start of the li
          const range = sel.getRangeAt(0);
          const liRange = document.createRange();
          liRange.selectNodeContents(li);
          liRange.setEnd(range.startContainer, range.startOffset);
          // The ZWSP caret anchor after a checkbox still counts as "start"
          const textBefore = liRange.toString().replace(/\u200B/g, "");
          const checkbox = li.querySelector('input[type="checkbox"]');
          if (textBefore === "" || (checkbox && textBefore === "")) {
            e.preventDefault();
            const ul = li.parentElement;
            // Remove checkbox if present
            checkbox?.remove();
            // Convert li content to a paragraph
            const p = document.createElement("p");
            while (li.firstChild) p.appendChild(li.firstChild);
            if (!p.textContent && !p.querySelector("br")) p.innerHTML = "<br>";
            if (ul) {
              // If this is the only item, replace the whole list
              if (ul.children.length <= 1) {
                ul.replaceWith(p);
              } else {
                // Insert paragraph before the list, remove the li
                ul.parentElement?.insertBefore(p, ul);
                li.remove();
              }
            }
            // Place cursor at start of the new paragraph
            const newRange = document.createRange();
            newRange.setStart(p, 0);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);
            syncToMarkdown();
            return;
          }
        }
      }
    }

    // Enter at the end of a heading or quote → continue with a plain
    // paragraph (Notion-style) instead of extending the block
    if (e.key === "Enter" && !e.shiftKey) {
      const sel = window.getSelection();
      if (sel?.anchorNode && sel.isCollapsed && editorRef.current?.contains(sel.anchorNode)) {
        const el =
          sel.anchorNode.nodeType === Node.TEXT_NODE
            ? sel.anchorNode.parentElement
            : (sel.anchorNode as HTMLElement);
        const heavyBlock = el?.closest("h1, h2, h3, blockquote");
        if (heavyBlock && editorRef.current.contains(heavyBlock)) {
          const range = sel.getRangeAt(0);
          const tail = document.createRange();
          tail.selectNodeContents(heavyBlock);
          tail.setStart(range.endContainer, range.endOffset);
          if (tail.toString() === "") {
            e.preventDefault();
            const p = document.createElement("p");
            p.innerHTML = "<br>";
            heavyBlock.after(p);
            const newRange = document.createRange();
            newRange.setStart(p, 0);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);
            syncToMarkdown();
            return;
          }
        }
      }
    }

    // Enter inside a list → browser handles new <li> automatically.
    // But if the <li> is empty, break out of the list.
    if (e.key === "Enter") {
      const sel = window.getSelection();
      if (sel?.anchorNode) {
        const li =
          (sel.anchorNode as HTMLElement).closest?.("li") ||
          sel.anchorNode.parentElement?.closest("li");
        // The ZWSP caret anchor makes a visually empty checklist item
        // non-empty in textContent — strip it before deciding
        const liText = li?.textContent?.replace(/\u200B/g, "").trim();
        // Enter on a non-empty checklist item → the next item gets a
        // checkbox too (the browser would insert a plain bullet)
        if (li && liText && li.querySelector('input[type="checkbox"]')) {
          e.preventDefault();
          const range = sel.getRangeAt(0);
          const tail = document.createRange();
          tail.selectNodeContents(li);
          tail.setStart(range.endContainer, range.endOffset);
          const rest = tail.extractContents();
          const newLi = document.createElement("li");
          const [cb, anchor] = makeCheckbox();
          newLi.appendChild(cb);
          newLi.appendChild(anchor);
          newLi.appendChild(rest);
          li.after(newLi);
          const newRange = document.createRange();
          newRange.setStart(anchor, 1);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);
          syncToMarkdown();
          return;
        }
        // Enter on an empty item (bullet or checkbox) → remove it and
        // break out of the list into a fresh paragraph, splitting the
        // list when items follow
        if (li && !liText) {
          e.preventDefault();
          const ul = li.parentElement;
          const p = document.createElement("p");
          p.innerHTML = "<br>";
          if (ul) {
            const following = Array.from(ul.children).filter(
              (child) => child.compareDocumentPosition(li) & Node.DOCUMENT_POSITION_PRECEDING,
            );
            li.remove();
            ul.after(p);
            if (following.length > 0) {
              const rest = document.createElement("ul");
              following.forEach((item) => rest.appendChild(item));
              p.after(rest);
            }
            if (ul.children.length === 0) ul.remove();
          }
          const range = document.createRange();
          range.setStart(p, 0);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          syncToMarkdown();
        }
      }
    }
  };

  /* ── Floating toolbar (selection-based) ─────────────── */

  const checkSelection = useCallback(() => {
    const sel = window.getSelection();
    if (
      !sel ||
      sel.isCollapsed ||
      !editorRef.current?.contains(sel.anchorNode)
    ) {
      setShowToolbar(false);
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setToolbarPos({
      top: rect.top - 48,
      left: rect.left + rect.width / 2 - 80,
    });
    setShowToolbar(true);
  }, []);

  useEffect(() => {
    const up = () => setTimeout(checkSelection, 10);
    const key = (e: KeyboardEvent) => {
      if (e.shiftKey) setTimeout(checkSelection, 10);
    };
    document.addEventListener("mouseup", up);
    document.addEventListener("keyup", key);
    return () => {
      document.removeEventListener("mouseup", up);
      document.removeEventListener("keyup", key);
    };
  }, [checkSelection]);

  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (
        toolbarRef.current &&
        !toolbarRef.current.contains(e.target as Node) &&
        editorRef.current &&
        !editorRef.current.contains(e.target as Node)
      ) {
        setShowToolbar(false);
      }
    };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, []);

  const handleFormat = (action: FormatAction) => {
    editorRef.current?.focus();
    switch (action) {
      case "bold":
        document.execCommand("bold");
        break;
      case "italic":
        document.execCommand("italic");
        break;
      case "strikethrough":
        document.execCommand("strikethrough");
        break;
      case "checklist": {
        document.execCommand("insertUnorderedList");
        // Add checkboxes to the new list items
        const sel = window.getSelection();
        const li =
          (sel?.anchorNode as HTMLElement)?.closest?.("li") ||
          sel?.anchorNode?.parentElement?.closest("li");
        if (li && !li.querySelector('input[type="checkbox"]')) {
          const [cb, anchor] = makeCheckbox();
          li.insertBefore(anchor, li.firstChild);
          li.insertBefore(cb, anchor);
          // An empty item needs the caret parked on the anchor
          if (!li.textContent?.replace(/\u200B/g, "")) {
            const r = document.createRange();
            r.setStart(anchor, 1);
            r.collapse(true);
            sel?.removeAllRanges();
            sel?.addRange(r);
          }
        }
        break;
      }
      case "link": {
        // Save the current selection before focus leaves the editor
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          savedSelection.current = sel.getRangeAt(0).cloneRange();
        }
        setShowLinkInput(true);
        setShowToolbar(false);
        setLinkUrl("");
        setTimeout(() => linkInputRef.current?.focus(), 0);
        return; // Don't syncToMarkdown or hide toolbar yet
      }
    }
    syncToMarkdown();
    setShowToolbar(false);
  };

  // Handle checkbox and link clicks
  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" && (target as HTMLInputElement).type === "checkbox") {
      // Toggle happens natively, just sync
      setTimeout(syncToMarkdown, 0);
    }
    // Open links in browser on click
    const anchor = target.closest("a");
    if (anchor) {
      e.preventDefault();
      const href = anchor.getAttribute("href");
      if (href) openUrl(href);
    }
  };

  const insertLink = (url: string) => {
    if (!url) return;
    const sel = window.getSelection();
    const range = savedSelection.current;
    if (!range || !editorRef.current) return;

    // Restore the saved selection
    sel?.removeAllRanges();
    sel?.addRange(range);

    const selectedText = range.toString();
    const linkText = selectedText || url;
    const a = document.createElement("a");
    a.href = url;
    a.textContent = linkText;

    range.deleteContents();
    range.insertNode(a);

    // Move cursor after the link
    const newRange = document.createRange();
    newRange.setStartAfter(a);
    newRange.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(newRange);

    savedSelection.current = null;
    setShowLinkInput(false);
    setLinkUrl("");
    syncToMarkdown();
    editorRef.current.focus();
  };

  /* ── Toolbar button icons ───────────────────────────── */

  const buttons: {
    action: FormatAction;
    icon: React.ReactNode;
    label: string;
  }[] = [
    {
      action: "bold",
      label: "Bold",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M5 4h7.5a4.5 4.5 0 0 1 3.256 7.606A5 5 0 0 1 13 22H5V4Zm2 2v5h5.5a2.5 2.5 0 0 0 0-5H7Zm0 7v5h6a3 3 0 0 0 0-6H7Z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    {
      action: "italic",
      label: "Italic",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M10 5h6M8 19h6M14.5 5l-5 14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
    {
      action: "checklist",
      label: "Checklist",
      icon: (
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
      ),
    },
    {
      action: "link",
      label: "Link",
      icon: (
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
      ),
    },
    {
      action: "strikethrough",
      label: "Strikethrough",
      icon: (
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
      ),
    },
  ];

  // Compute min-height from rows
  const minHeight = rows ? `${rows * 1.5}em` : undefined;

  return (
    <div className="relative w-full">
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onPaste={handlePaste}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        data-placeholder={placeholder}
        className={`prose-card outline-none ${className}`}
        style={{ minHeight }}
      />

      {/* Floating toolbar */}
      {showToolbar && (
        <div
          ref={toolbarRef}
          className="fixed z-[200] flex items-center gap-0.5 px-1.5 py-1.5 bg-[#2a2b2e] rounded-xl shadow-lg border border-white/10"
          style={{ top: toolbarPos.top, left: toolbarPos.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {buttons.map((btn) => (
            <button
              key={btn.action}
              onClick={() => handleFormat(btn.action)}
              title={btn.label}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[#9ca3af] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              {btn.icon}
            </button>
          ))}
        </div>
      )}

      {/* Link input popover */}
      {showLinkInput && (
        <div
          className="fixed z-[200] px-3 py-2 bg-[#2a2b2e] rounded-xl shadow-lg border border-white/10"
          style={{ top: toolbarPos.top, left: toolbarPos.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <input
            ref={linkInputRef}
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                insertLink(linkUrl.trim());
              }
              if (e.key === "Escape") {
                setShowLinkInput(false);
                setLinkUrl("");
                editorRef.current?.focus();
              }
            }}
            onBlur={() => {
              setShowLinkInput(false);
              setLinkUrl("");
            }}
            placeholder="https://your.link"
            className="w-56 bg-transparent text-sm text-[#A8B4C6] placeholder:text-[#5C626B] outline-none"
          />
        </div>
      )}
    </div>
  );
}
