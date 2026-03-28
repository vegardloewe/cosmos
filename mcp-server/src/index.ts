#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// ── Types ────────────────────────────────────────────────────────────

interface BoardItem {
  id: string;
  type: "image" | "video" | "link" | "text";
  createdAt: string;
  updatedAt: string;
  tags: string[];
  collectionIds: string[];
  color?: string;
  assetPath?: string;
  width?: number;
  height?: number;
  url?: string;
  linkTitle?: string;
  linkDescription?: string;
  linkPreviewPath?: string;
  notePath?: string;
  title?: string;
  excerpt?: string;
}

interface Collection {
  id: string;
  name: string;
  color: string;
}

interface VaultIndex {
  version: number;
  items: BoardItem[];
  collections: Collection[];
}

// ── Vault helpers ────────────────────────────────────────────────────

const VAULT_PATH = process.env.MOODBOARD_VAULT;

function getVaultPath(): string {
  if (!VAULT_PATH) {
    throw new Error(
      "MOODBOARD_VAULT environment variable is not set. Set it to your vault folder path."
    );
  }
  return VAULT_PATH;
}

function indexPath(): string {
  return path.join(getVaultPath(), ".moodboard", "index.json");
}

function readIndex(): VaultIndex {
  const raw = fs.readFileSync(indexPath(), "utf-8");
  return JSON.parse(raw);
}

function writeIndex(index: VaultIndex): void {
  const vault = getVaultPath();
  const tmp = path.join(vault, ".moodboard", "index.json.tmp");
  const dest = indexPath();
  fs.writeFileSync(tmp, JSON.stringify(index, null, 2));
  fs.renameSync(tmp, dest);
}

function nanoid(size = 21): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  const bytes = crypto.randomBytes(size);
  let id = "";
  for (let i = 0; i < size; i++) {
    id += alphabet[bytes[i] % alphabet.length];
  }
  return id;
}

function nowMillis(): string {
  return Date.now().toString();
}

// ── MCP Server ───────────────────────────────────────────────────────

const server = new McpServer({
  name: "moodboard",
  version: "0.1.0",
});

// ── Tools ────────────────────────────────────────────────────────────

server.tool(
  "list_items",
  "List items in the moodboard vault. Can filter by type, tag, or collection.",
  {
    type: z
      .enum(["image", "video", "link", "text"])
      .optional()
      .describe("Filter by item type"),
    tag: z.string().optional().describe("Filter by tag"),
    collection: z.string().optional().describe("Filter by collection name"),
    limit: z.number().optional().describe("Max items to return (default 50)"),
  },
  async ({ type, tag, collection, limit }) => {
    const index = readIndex();
    let items = index.items;

    if (type) items = items.filter((i) => i.type === type);
    if (tag)
      items = items.filter((i) =>
        i.tags.some((t) => t.toLowerCase().includes(tag.toLowerCase()))
      );
    if (collection) {
      const col = index.collections.find(
        (c) => c.name.toLowerCase() === collection.toLowerCase()
      );
      if (col) items = items.filter((i) => i.collectionIds.includes(col.id));
    }

    items = items.slice(0, limit ?? 50);

    const lines = items.map((i) => {
      const label =
        i.title || i.linkTitle || i.url || i.excerpt?.slice(0, 60) || i.id;
      const tags = i.tags.length ? ` [${i.tags.join(", ")}]` : "";
      return `- ${i.type}: ${label}${tags} (id: ${i.id})`;
    });

    return {
      content: [
        {
          type: "text" as const,
          text:
            lines.length > 0
              ? `Found ${items.length} items:\n${lines.join("\n")}`
              : "No items found.",
        },
      ],
    };
  }
);

server.tool(
  "search_items",
  "Search items by keyword across titles, descriptions, tags, URLs, and excerpts.",
  {
    query: z.string().describe("Search query"),
  },
  async ({ query }) => {
    const index = readIndex();
    const q = query.toLowerCase();
    const items = index.items.filter((i) => {
      const fields = [
        i.title,
        i.linkTitle,
        i.linkDescription,
        i.url,
        i.excerpt,
        ...i.tags,
      ];
      return fields.some((f) => f?.toLowerCase().includes(q));
    });

    const lines = items.slice(0, 30).map((i) => {
      const label =
        i.title || i.linkTitle || i.url || i.excerpt?.slice(0, 60) || i.id;
      const tags = i.tags.length ? ` [${i.tags.join(", ")}]` : "";
      return `- ${i.type}: ${label}${tags} (id: ${i.id})`;
    });

    return {
      content: [
        {
          type: "text" as const,
          text:
            lines.length > 0
              ? `Found ${items.length} matching items:\n${lines.join("\n")}`
              : "No items matched your search.",
        },
      ],
    };
  }
);

server.tool(
  "get_item",
  "Get full details of a specific item by ID.",
  {
    id: z.string().describe("Item ID"),
  },
  async ({ id }) => {
    const index = readIndex();
    const item = index.items.find((i) => i.id === id);
    if (!item) {
      return {
        content: [{ type: "text" as const, text: `Item not found: ${id}` }],
        isError: true,
      };
    }

    // If it's a text note, read the markdown content
    let noteContent: string | undefined;
    if (item.type === "text" && item.notePath) {
      const notePath = path.join(
        getVaultPath(),
        ".moodboard",
        "notes",
        item.notePath
      );
      if (fs.existsSync(notePath)) {
        noteContent = fs.readFileSync(notePath, "utf-8");
      }
    }

    const details: Record<string, unknown> = { ...item };
    if (noteContent) details.noteContent = noteContent;

    // Resolve asset path to absolute
    if (item.assetPath) {
      details.absoluteAssetPath = path.join(
        getVaultPath(),
        ".moodboard",
        "assets",
        item.assetPath
      );
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(details, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "add_note",
  "Add a text note to the moodboard.",
  {
    title: z.string().describe("Note title"),
    content: z.string().describe("Note content (markdown)"),
    tags: z.array(z.string()).optional().describe("Tags for the note"),
  },
  async ({ title, content, tags }) => {
    const vault = getVaultPath();
    const id = nanoid();
    const filename = `${id}.md`;
    const notePath = path.join(vault, ".moodboard", "notes", filename);
    fs.writeFileSync(notePath, content);

    const excerpt =
      content.length > 100 ? content.slice(0, 100) + "..." : content;
    const now = nowMillis();
    const item: BoardItem = {
      id,
      type: "text",
      createdAt: now,
      updatedAt: now,
      tags: tags ?? [],
      collectionIds: [],
      notePath: filename,
      title,
      excerpt,
    };

    const index = readIndex();
    index.items.push(item);
    writeIndex(index);

    return {
      content: [
        {
          type: "text" as const,
          text: `Added note "${title}" (id: ${id})`,
        },
      ],
    };
  }
);

server.tool(
  "add_link",
  "Add a link/URL to the moodboard. Note: this does not fetch OG metadata (use the app for rich previews).",
  {
    url: z.string().describe("URL to add"),
    title: z.string().optional().describe("Title for the link"),
    description: z.string().optional().describe("Description"),
    tags: z.array(z.string()).optional().describe("Tags"),
  },
  async ({ url, title, description, tags }) => {
    const id = nanoid();
    const now = nowMillis();
    const item: BoardItem = {
      id,
      type: "link",
      createdAt: now,
      updatedAt: now,
      tags: tags ?? [],
      collectionIds: [],
      url,
      linkTitle: title,
      linkDescription: description,
    };

    const index = readIndex();
    index.items.push(item);
    writeIndex(index);

    return {
      content: [
        {
          type: "text" as const,
          text: `Added link "${title || url}" (id: ${id})`,
        },
      ],
    };
  }
);

server.tool(
  "tag_item",
  "Add or remove tags on an item.",
  {
    id: z.string().describe("Item ID"),
    add: z.array(z.string()).optional().describe("Tags to add"),
    remove: z.array(z.string()).optional().describe("Tags to remove"),
  },
  async ({ id, add, remove }) => {
    const index = readIndex();
    const item = index.items.find((i) => i.id === id);
    if (!item) {
      return {
        content: [{ type: "text" as const, text: `Item not found: ${id}` }],
        isError: true,
      };
    }

    if (add) {
      for (const tag of add) {
        const lower = tag.toLowerCase();
        if (!item.tags.includes(lower)) item.tags.push(lower);
      }
    }
    if (remove) {
      item.tags = item.tags.filter(
        (t) => !remove.some((r) => r.toLowerCase() === t.toLowerCase())
      );
    }
    item.updatedAt = nowMillis();
    writeIndex(index);

    return {
      content: [
        {
          type: "text" as const,
          text: `Updated tags for ${id}: [${item.tags.join(", ")}]`,
        },
      ],
    };
  }
);

server.tool(
  "update_item",
  "Update an item's title, description, or URL.",
  {
    id: z.string().describe("Item ID"),
    title: z.string().optional().describe("New title"),
    description: z.string().optional().describe("New description"),
    url: z.string().optional().describe("New URL"),
  },
  async ({ id, title, description, url }) => {
    const index = readIndex();
    const item = index.items.find((i) => i.id === id);
    if (!item) {
      return {
        content: [{ type: "text" as const, text: `Item not found: ${id}` }],
        isError: true,
      };
    }

    if (title !== undefined) {
      if (item.type === "link") item.linkTitle = title;
      else item.title = title;
    }
    if (description !== undefined) item.linkDescription = description;
    if (url !== undefined) item.url = url;
    item.updatedAt = nowMillis();
    writeIndex(index);

    return {
      content: [
        { type: "text" as const, text: `Updated item ${id}` },
      ],
    };
  }
);

server.tool(
  "delete_item",
  "Delete an item from the moodboard.",
  {
    id: z.string().describe("Item ID"),
  },
  async ({ id }) => {
    const index = readIndex();
    const pos = index.items.findIndex((i) => i.id === id);
    if (pos === -1) {
      return {
        content: [{ type: "text" as const, text: `Item not found: ${id}` }],
        isError: true,
      };
    }

    const item = index.items[pos];
    const vault = getVaultPath();

    // Clean up files
    if (item.assetPath) {
      const p = path.join(vault, ".moodboard", "assets", item.assetPath);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    if (item.notePath) {
      const p = path.join(vault, ".moodboard", "notes", item.notePath);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    if (item.linkPreviewPath) {
      const p = path.join(vault, ".moodboard", "assets", item.linkPreviewPath);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }

    index.items.splice(pos, 1);
    writeIndex(index);

    return {
      content: [
        {
          type: "text" as const,
          text: `Deleted item ${id} (${item.type}: ${item.title || item.linkTitle || item.url || "untitled"})`,
        },
      ],
    };
  }
);

server.tool(
  "list_collections",
  "List all collections in the vault.",
  {},
  async () => {
    const index = readIndex();
    if (index.collections.length === 0) {
      return {
        content: [{ type: "text" as const, text: "No collections." }],
      };
    }

    const lines = index.collections.map((c) => {
      const count = index.items.filter((i) =>
        i.collectionIds.includes(c.id)
      ).length;
      return `- ${c.name} (${c.color}, ${count} items, id: ${c.id})`;
    });

    return {
      content: [
        {
          type: "text" as const,
          text: `Collections:\n${lines.join("\n")}`,
        },
      ],
    };
  }
);

server.tool(
  "vault_stats",
  "Get summary statistics about the vault.",
  {},
  async () => {
    const index = readIndex();
    const byType: Record<string, number> = {};
    for (const item of index.items) {
      byType[item.type] = (byType[item.type] || 0) + 1;
    }

    const allTags = new Set(index.items.flatMap((i) => i.tags));

    const lines = [
      `Total items: ${index.items.length}`,
      ...Object.entries(byType).map(([t, n]) => `  ${t}: ${n}`),
      `Collections: ${index.collections.length}`,
      `Unique tags: ${allTags.size}`,
      `Vault path: ${getVaultPath()}`,
    ];

    return {
      content: [{ type: "text" as const, text: lines.join("\n") }],
    };
  }
);

// ── Start ────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
server.connect(transport);
