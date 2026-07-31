# Cosmos iCloud Vault bridge

Internal Tauri mobile plugin for Cosmos. On iOS it opens a user-selected
iCloud Drive vault folder, retains access with a bookmark, and coordinates
reads and writes to `.moodboard/tasks.json` through `NSFileCoordinator`.

It is intentionally app-specific and is not published as a general plugin.
