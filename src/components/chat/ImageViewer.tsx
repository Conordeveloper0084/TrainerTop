"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

// Rasmni butun ekranda ko'rish. Bosilsa yoki Escape bosilsa yopiladi.
export function ImageViewer({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-label="Rasm">
      <button onClick={onClose} aria-label="Yopish" className="absolute top-4 right-4 text-white/70 hover:text-white p-2"><X className="h-6 w-6" /></button>
      <img src={url} alt="" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}
