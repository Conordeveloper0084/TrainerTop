"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { cn } from "@/lib/utils";

// Ilova ichidagi tasdiq oynasi (brauzerning oddiy confirm() o'rniga): o'chirishdan oldin ikkinchi marta so'raladi,
// xavfli tugma qizil. askConfirm({...}) → Promise<boolean>. <ConfirmHost /> sahifada bir marta turadi (workouts layout).
export interface ConfirmOptions { title: string; message?: string; confirmText?: string; cancelText?: string; danger?: boolean }
interface State { opts: ConfirmOptions | null; resolve: ((v: boolean) => void) | null }
const useConfirmStore = create<State>(() => ({ opts: null, resolve: null }));

export function askConfirm(opts: ConfirmOptions): Promise<boolean> {
  const prev = useConfirmStore.getState().resolve;
  if (prev) prev(false);
  return new Promise((resolve) => useConfirmStore.setState({ opts, resolve }));
}
function close(v: boolean) {
  const { resolve } = useConfirmStore.getState();
  useConfirmStore.setState({ opts: null, resolve: null });
  resolve?.(v);
}

export function ConfirmHost() {
  const opts = useConfirmStore((s) => s.opts);
  useEffect(() => {
    if (!opts) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [opts]);
  useEffect(() => () => { if (useConfirmStore.getState().resolve) close(false); }, []);
  if (!opts) return null;
  const danger = opts.danger !== false;
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-label={opts.title} data-testid="confirm-dialog">
      <button type="button" aria-label="Yopish" className="absolute inset-0 bg-black/80" onClick={() => close(false)} />
      <div className="relative w-full max-w-sm bg-dark-surface border border-white/[0.08] rounded-2xl p-5">
        <p className="text-[17px] font-semibold text-white">{opts.title}</p>
        {opts.message && <p className="text-sm text-white/60 mt-2 whitespace-pre-line">{opts.message}</p>}
        <div className="grid grid-cols-2 gap-2 mt-5">
          <button type="button" onClick={() => close(false)} className="btn-ghost !py-3 text-sm" data-testid="confirm-cancel" autoFocus>{opts.cancelText || "Bekor"}</button>
          <button type="button" onClick={() => close(true)} data-testid="confirm-ok"
            className={cn("rounded-xl !py-3 text-sm font-semibold", danger ? "bg-red-500 text-white hover:bg-red-600" : "btn-lime")}>
            {opts.confirmText || (danger ? "O'chirish" : "Ha")}
          </button>
        </div>
      </div>
    </div>
  );
}
