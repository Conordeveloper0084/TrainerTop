"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, BookOpen, MessageCircle, User, Image as ImageIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/auth-store";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const [chatUnread, setChatUnread] = useState(0);

  // Admin sahifalarda ko'rinmasin, chat ichida xabar yozayotgan bo'lsa ham yashirish
  const hidden = pathname.startsWith("/admin")
    || pathname.startsWith("/login")
    || pathname.startsWith("/register")
    || pathname.startsWith("/auth/")
    || (pathname === "/chat" && typeof window !== "undefined" && window.location.search.includes("with="));

  // Chat unread
  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      try {
        const res = await fetch("/api/chat");
        const data = await res.json();
        if (Array.isArray(data)) {
          setChatUnread(data.reduce((s: number, c: any) => s + (c.my_unread || 0), 0));
        }
      } catch {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => clearInterval(interval);
  }, [user]);

  if (hidden) return null;

  // Bosh sahifa olib tashlandi, Postlar qo'shildi
  const links = [
    { href: "/trainers", icon: Users, label: "Trenerlar" },
    { href: "/lessons", icon: BookOpen, label: "Darsliklar" },
    { href: "/posts", icon: ImageIcon, label: "Postlar" },
    { href: "/chat", icon: MessageCircle, label: "Chat", badge: chatUnread },
    { href: "/profile", icon: User, label: "Profil" },
  ];

  const isActive = (h: string) => pathname.startsWith(h);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-dark-surface/95 backdrop-blur-xl border-t border-white/[0.06] pb-safe">
      <div className="grid grid-cols-5 gap-1 px-2 py-2">
        {links.map((l) => {
          const active = isActive(l.href);
          const showBadge = typeof l.badge === "number" && l.badge > 0;
          return (
            <Link key={l.href} href={l.href}
              className={cn("flex flex-col items-center justify-center gap-1 py-1.5 rounded-lg transition-all relative",
                active ? "text-lime" : "text-white/40 active:text-white/70")}>
              <div className="relative">
                <l.icon className={cn("transition-all", active ? "h-5 w-5" : "h-[18px] w-[18px]")} strokeWidth={active ? 2.5 : 2} />
                {showBadge ? (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1">
                    {l.badge! > 9 ? "9+" : l.badge}
                  </span>
                ) : null}
              </div>
              <span className={cn("text-[9px] leading-none transition-all", active ? "font-semibold" : "font-normal")}>
                {l.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
