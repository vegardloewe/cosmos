import { useEffect } from "react";
import { useBoardStore } from "../stores/board-store";

export function useVault() {
  const loadVault = useBoardStore((s) => s.loadVault);

  useEffect(() => {
    loadVault();
  }, [loadVault]);
}
