import { open } from "@tauri-apps/plugin-dialog";
import { useBoardStore } from "../stores/board-store";

export function VaultPicker() {
  const createNewVault = useBoardStore((s) => s.createNewVault);
  const openExistingVault = useBoardStore((s) => s.openExistingVault);

  const handleCreate = async () => {
    const selected = await open({ directory: true, title: "Choose a folder for your new vault" });
    if (selected) {
      await createNewVault(selected);
    }
  };

  const handleOpen = async () => {
    const selected = await open({ directory: true, title: "Open an existing vault" });
    if (selected) {
      await openExistingVault(selected);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-bg">
      <div className="flex flex-col items-center gap-8 max-w-md w-full px-6">
        <div className="flex flex-col items-center gap-4">
          <img src="/cosmos-icon.png" alt="Cosmos" className="w-24 h-24 rounded-2xl" />
          <h1 className="text-5xl font-bold tracking-tight text-text">
            Cosmos
          </h1>
          <p className="text-text-muted text-lg">
            Your local creative space
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={handleCreate}
            className="w-full py-3 px-6 bg-white text-bg font-semibold rounded-xl hover:bg-white/90 transition-colors cursor-pointer"
          >
            Create New Vault
          </button>
          <button
            onClick={handleOpen}
            className="w-full py-3 px-6 bg-surface text-text font-semibold rounded-xl border border-border hover:bg-bg transition-colors cursor-pointer"
          >
            Open Existing Vault
          </button>
        </div>
      </div>
    </div>
  );
}
