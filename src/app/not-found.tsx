"use client";

import Link from "next/link";
import { Home, ArrowLeft, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-dark flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="relative mb-8">
          <div className="text-[140px] sm:text-[180px] font-bold text-lime/10 leading-none select-none">404</div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-2xl bg-lime/10 border-2 border-lime/30 flex items-center justify-center">
              <Compass className="h-10 w-10 text-lime" />
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-bold mb-2">Sahifa topilmadi</h1>
        <p className="text-sm text-white/40 mb-8 leading-relaxed">
          Siz qidirayotgan sahifa mavjud emas yoki ko'chirilgan bo'lishi mumkin. Bosh sahifaga qaytib keyin urinib ko'ring.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/" className="btn-lime flex items-center justify-center gap-2 !px-6">
            <Home className="h-4 w-4" />Bosh sahifa
          </Link>
          <button onClick={() => window.history.back()} className="btn-outline flex items-center justify-center gap-2 !px-6">
            <ArrowLeft className="h-4 w-4" />Orqaga
          </button>
        </div>
      </div>
    </div>
  );
}
