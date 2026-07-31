# Cosmos

A local-first personal workspace for macOS and iPhone. Collect images, links, and text notes in a visual masonry grid, while keeping tasks in sync through an iCloud Drive vault you choose.

Built with Tauri 2 + React + TypeScript.

![Cosmos Screenshot](screenshot.png)

## Features

- **Vault-based storage** — Obsidian-style plain files in a user-chosen folder. No database, no cloud lock-in.
- **Image import** — Drag-and-drop or file picker. Copies to vault, extracts dimensions and dominant color.
- **Link import** — Paste a URL, fetches OG metadata and preview thumbnail automatically.
- **Text notes** — Markdown notes stored as `.md` files.
- **Video import** — Import video files with in-app playback.
- **Masonry grid** — CSS columns layout with responsive column count.
- **Tags** — Add/remove tags on any item, filter by tag.
- **Collections** — Organize items into named collections with color coding.
- **Search** — Client-side search across titles, tags, URLs, and descriptions.
- **AI auto-tagging** — Optional OpenAI-powered tag suggestions and descriptions on import.
- **Frameless window** — Native macOS traffic lights integrated into the toolbar.
- **MCP server** — Claude Desktop integration for managing your vault via natural language.
- **Private iPhone task app** — Install directly from Xcode; no App Store listing or external backend required.

## Tech Stack

| Layer         | Choice                                            |
| ------------- | ------------------------------------------------- |
| Shell         | Tauri 2.0 (WKWebView, ~5MB binary)                |
| Frontend      | React 19 + TypeScript + Vite                      |
| Styling       | Tailwind CSS 4                                    |
| State         | Zustand                                           |
| Backend       | Rust (`#[tauri::command]`)                        |
| Link previews | `reqwest` + `scraper` (Rust-side OG tag fetching) |
| AI            | OpenAI GPT-4o (optional)                          |

## Vault Structure

```
~/MyVault/
├── .moodboard/
│   ├── index.json          # Metadata index for all items
│   ├── tasks.json          # Projects and tasks; safe to sync independently
│   └── assets/             # Images, videos, link thumbnails
│       ├── a1b2c3d4.jpg
│       └── e5f6g7h8-preview.jpg
│   └── notes/              # Text notes as markdown
│       └── m3n4o5p6.md
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/)
- [Tauri CLI](https://v2.tauri.app/start/prerequisites/)

### Setup

```bash
# Install dependencies
npm install

# Create a .env file with your OpenAI API key (optional, for AI tagging)
echo "OPENAI_API_KEY=your-key-here" > .env

# Run in development
npm run tauri dev

# Build for production
npm run tauri build
```

The built app will be at `src-tauri/target/release/bundle/macos/Cosmos.app`. Open the generated `.dmg` and drag Cosmos into Applications.

![Installation](app-installation.png)

### Private iPhone installation

Cosmos’s iPhone app is task-first and connects directly to the same iCloud Drive vault—there is no App Store listing and no Supabase account.

1. Open your vault in the Mac app once. Existing task data is migrated automatically to `.moodboard/tasks.json`.
2. Connect your iPhone to the Mac, unlock it, and trust the Mac when prompted.
3. Run the iOS app with your Apple Developer Team ID:

   ```bash
   APPLE_DEVELOPMENT_TEAM=YOUR_TEAM_ID npm run ios:dev
   ```

4. In the iPhone app, tap **Connect iCloud Vault** and select that same vault folder in Files → iCloud Drive.

The iPhone app remembers the folder permission, uses Apple’s coordinated iCloud file access for `tasks.json`, and works offline. Before installing to a physical device, replace the example `com.cosmos.app` identifier in `src-tauri/tauri.conf.json` with a bundle identifier registered to your Apple Developer team.

### MCP Server (Claude Desktop)

The `mcp-server/` directory contains an MCP server for Claude Desktop integration.

```bash
cd mcp-server
npm install
npm run build
```

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "cosmos": {
      "command": "node",
      "args": ["/path/to/cosmos/mcp-server/dist/index.js"],
      "env": {
        "COSMOS_VAULT": "/path/to/your/vault"
      }
    }
  }
}
```

## License

MIT
