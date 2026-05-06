"use client";

import Link from "next/link";
import { Zap } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-dark">
      <div className="container-main py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <img src="/app-icon.png" alt="TrainerTop" className="h-9 w-9 rounded-xl" />
              <span className="text-lg font-bold tracking-tight">
                trainer<span className="text-lime">top</span>
              </span>
            </Link>
            <p className="text-white/40 text-sm max-w-sm leading-relaxed">
              O'zbekistonning #1 fitness platformasi. Ishonchli trener toping,
              darsliklar sotib oling, maqsadingizga erishining.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Platforma</h4>
            <div className="flex flex-col gap-2.5">
              <Link href="/trainers" className="text-sm text-white/40 hover:text-lime transition-colors">Trenerlar</Link>
              <Link href="/lessons" className="text-sm text-white/40 hover:text-lime transition-colors">Darsliklar</Link>
              <Link href="/posts" className="text-sm text-white/40 hover:text-lime transition-colors">Postlar</Link>
              <Link href="/ai" className="text-sm text-white/40 hover:text-lime transition-colors">AI Assistant</Link>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Qo'shimcha</h4>
            <div className="flex flex-col gap-2.5">
              <Link href="/support" className="text-sm text-white/40 hover:text-lime transition-colors">Yordam</Link>
              <Link href="/privacy" className="text-sm text-white/40 hover:text-lime transition-colors">Maxfiylik siyosati</Link>
              <Link href="/terms" className="text-sm text-white/40 hover:text-lime transition-colors">Foydalanish shartlari</Link>
            </div>
          </div>
        </div>

        <div className="border-t border-white/[0.06] mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/30">
            © 2026 Trainertop. Barcha huquqlar himoyalangan.
          </p>
          <div className="flex items-center gap-4">
            <a href="https://t.me/TrainerTop" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-white/30 hover:text-lime transition-colors">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
              Telegram
            </a>
            <a href="https://instagram.com/trainertop" target="_blank" rel="noopener noreferrer"
              className="text-xs text-white/30 hover:text-lime transition-colors">
              Instagram
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
