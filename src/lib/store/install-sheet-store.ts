import { create } from "zustand";

// Hamburger yonidagi ikonka va hamburger menyusidagi band — IKKALASI ham shu bitta ulashilgan
// holatni ochadi, shunday qilib bitta joyda saqlanadigan bitta pastdan chiqadigan oyna bo'ladi.
interface InstallSheetState { open: boolean; show: () => void; hide: () => void }

export const useInstallSheetStore = create<InstallSheetState>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));
