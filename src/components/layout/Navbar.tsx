"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LogOut, User, Settings, ChevronDown, Dumbbell, Headphones, Sun, Moon } from "lucide-react";
import { toast } from "sonner";
import { cn, getInitials } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/auth-store";
import { createClient } from "@/lib/supabase/client";

const PUBLIC_LINKS = [
  { href: "/", label: "Bosh sahifa" },
  { href: "/trainers", label: "Trenerlar" },
  { href: "/lessons", label: "Darsliklar" },
  { href: "/posts", label: "Postlar" },
];

const TRAINER_LINKS = [
  { href: "/trainers", label: "Trenerlar" },
  { href: "/lessons", label: "Darsliklar" },
  { href: "/posts", label: "Postlar" },
  { href: "/chat", label: "Chatlar" },
];

const USER_LINKS = [
  { href: "/trainers", label: "Trenerlar" },
  { href: "/lessons", label: "Darsliklar" },
  { href: "/posts", label: "Postlar" },
  { href: "/chat", label: "Chatlar" },
];

export default function Navbar() {
  const [dropOpen, setDropOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const dropRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const loggedIn = !!user;
  const isTrainer = user?.role === "trainer";
  const links = loggedIn ? (isTrainer ? TRAINER_LINKS : USER_LINKS) : PUBLIC_LINKS;
  const active = (h: string) => (h === "/" ? pathname === "/" : pathname.startsWith(h));

  // Chat unread count
  useEffect(() => {
    if (!loggedIn) return;
    const fetchUnread = async () => {
      try {
        const res = await fetch("/api/chat");
        const data = await res.json();
        if (Array.isArray(data)) {
          const total = data.reduce((sum: number, c: any) => sum + (c.my_unread || 0), 0);
          setChatUnread(total);
        }
      } catch {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => clearInterval(interval);
  }, [loggedIn]);

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const handleLogout = async () => {
    setDropOpen(false);
    const supabase = createClient();
    await supabase.auth.signOut();
    useAuthStore.getState().logout();
    toast.success("Chiqdingiz");
    window.location.href = "/";
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] bg-dark/80 backdrop-blur-xl">
      <div className="container-main">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/app-icon.png" alt="TrainerTop" className="h-9 w-9 rounded-xl" />
            <span className="text-lg font-bold tracking-tight">
              trainer<span className="text-lime">top</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <Link key={l.href + l.label} href={l.href}
                className={cn("px-4 py-2 rounded-lg text-sm transition-colors relative",
                  active(l.href) ? "text-lime bg-lime-muted" : "text-white/60 hover:text-white hover:bg-white/5")}>
                {l.label}
                {l.href === "/chat" && chatUnread > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{chatUnread}</span>
                )}
              </Link>
            ))}
          </div>

          {/* Desktop right */}
          <div className="hidden md:flex items-center gap-3">
            <NotifBell loggedIn={loggedIn} />
            <ThemeToggle />
            <Link href="/support" className="p-2 rounded-lg text-white/30 hover:text-lime hover:bg-lime-subtle transition-colors" title="Yordam">
              <Headphones className="h-4 w-4" />
            </Link>

            {!ready ? (
              <div className="w-28 h-8 rounded-lg bg-white/[0.04] animate-pulse" />
            ) : loggedIn ? (
              <div className="relative" ref={dropRef}>
                <button onClick={() => setDropOpen(!dropOpen)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
                  <div className="h-8 w-8 rounded-full bg-lime/20 flex items-center justify-center text-lime text-xs font-bold shrink-0">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      getInitials(user.full_name)
                    )}
                  </div>
                  <span className="text-sm text-white/70 max-w-[120px] truncate">{user.full_name}</span>
                  <ChevronDown className={cn("h-3.5 w-3.5 text-white/30 transition-transform", dropOpen && "rotate-180")} />
                </button>

                {dropOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-dark-surface border border-white/[0.08] rounded-xl shadow-elevated overflow-hidden animate-fade-in z-50">
                    <div className="px-4 py-3 border-b border-white/[0.06]">
                      <p className="text-sm font-medium truncate">{user.full_name}</p>
                      <p className="text-xs text-white/30 truncate">{user.email}</p>
                      <span className={cn("inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full",
                        isTrainer ? "bg-lime-muted text-lime" : "bg-white/[0.06] text-white/40")}>
                        {isTrainer ? "Trener" : "Foydalanuvchi"}
                      </span>
                    </div>
                    <div className="py-1.5">
                      <DropItem href="/profile" icon={User} label="Profil" onClick={() => setDropOpen(false)} />
                      <DropItem href="/profile" icon={Settings} label="Sozlamalar" onClick={() => setDropOpen(false)} />
                      {!isTrainer && <DropItem href="/become-trainer" icon={Dumbbell} label="Trener bo'lish" onClick={() => setDropOpen(false)} lime />}
                    </div>
                    <div className="border-t border-white/[0.06] py-1.5">
                      <button onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-400/70 hover:text-red-400 hover:bg-red-400/[0.04] transition-colors w-full">
                        <LogOut className="h-4 w-4" />Chiqish
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link href="/login" className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors">Kirish</Link>
                <Link href="/register" className="btn-lime !py-2 !px-5 text-sm">Boshlash</Link>
              </>
            )}
          </div>

          {/* Mobile actions — bell, theme, support, login */}
          <div className="flex md:hidden items-center gap-1">
            {loggedIn && <NotifBell loggedIn={loggedIn} />}
            <ThemeToggle />
            <Link href="/support" className="p-2 rounded-lg text-white/30 hover:text-lime hover:bg-lime-subtle transition-colors" title="Yordam">
              <Headphones className="h-4 w-4" />
            </Link>
            {!loggedIn && (
              <Link href="/login" className="ml-1 px-3 py-1.5 rounded-lg bg-lime text-black text-xs font-semibold">
                Kirish
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

function DropItem({ href, icon: Icon, label, onClick, lime }: any) {
  return (
    <Link href={href} onClick={onClick}
      className={cn("flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
        lime ? "text-lime/70 hover:text-lime hover:bg-lime-subtle" : "text-white/60 hover:text-white hover:bg-white/[0.04]")}>
      <Icon className="h-4 w-4" />{label}
    </Link>
  );
}

function NotifBell({ loggedIn }: { loggedIn: boolean }) {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<any[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loggedIn) return;
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000); // 30 soniyada bir tekshirish
    return () => clearInterval(interval);
  }, [loggedIn]);

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const fetchNotifs = async () => {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      if (Array.isArray(data)) { setNotifs(data); setCount(data.filter((n: any) => !n.is_read).length); }
    } catch (e) {}
  };

  const markRead = async () => {
    await fetch("/api/notifications", { method: "PUT" });
    setCount(0);
    setNotifs((p) => p.map((n) => ({ ...n, is_read: true })));
  };

  if (!loggedIn) return null;

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => { setOpen(!open); if (!open && count > 0) markRead(); }}
        className="p-2 rounded-lg text-white/30 hover:text-lime hover:bg-lime-subtle transition-colors relative">
        <Bell className="h-4 w-4" />
        {count > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{count}</span>}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-dark-surface border border-white/[0.08] rounded-xl shadow-elevated overflow-hidden animate-fade-in z-50">
          <div className="px-4 py-3 border-b border-white/[0.06] flex justify-between items-center">
            <span className="text-sm font-medium">Bildirishnomalar</span>
            {notifs.length > 0 && <span className="text-[10px] text-white/30">{notifs.length}</span>}
          </div>
          <div className="max-h-64 overflow-y-auto">
            {notifs.length === 0 ? <p className="text-xs text-white/20 text-center py-6">Hali bildirishnoma yo'q</p> : notifs.slice(0, 10).map((n) => (
              <div key={n.id} className={cn("px-4 py-3 border-b border-white/[0.03] text-xs", !n.is_read && "bg-lime/[0.03]")}>
                <p className="font-medium text-white/70">{n.title}</p>
                {n.body && <p className="text-white/40 mt-0.5 truncate">{n.body}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("theme") || "dark";
    setTheme(saved as "dark" | "light");
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  return (
    <button onClick={toggle} className="p-2 rounded-lg text-white/30 hover:text-lime hover:bg-lime-subtle transition-colors" title={theme === "dark" ? "Kunduzgi rejim" : "Tungi rejim"}>
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
