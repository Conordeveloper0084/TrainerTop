"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Home, RefreshCw, AlertTriangle } from "lucide-react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="relative mb-8">
          <div className="text-[140px] sm:text-[180px] font-bold text-red-500/10 leading-none select-none">500</div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-2xl bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center">
              <AlertTriangle className="h-10 w-10 text-red-500" />
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-bold mb-2">Xatolik yuz berdi</h1>
        <p className="text-sm text-white/40 mb-8 leading-relaxed">
          Texnik nosozlik tufayli sahifani ko'rsatib bo'lmadi. Iltimos, bir oz kutib qaytadan urinib ko'ring.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={() => reset()} className="btn-lime flex items-center justify-center gap-2 !px-6">
            <RefreshCw className="h-4 w-4" />Qayta urinib ko'rish
          </button>
          <Link href="/" className="btn-outline flex items-center justify-center gap-2 !px-6">
            <Home className="h-4 w-4" />Bosh sahifa
          </Link>
        </div>
      </div>
    </div>
  );
}
