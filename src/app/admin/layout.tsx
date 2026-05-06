"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Users, Wallet, ArrowLeft, Loader2, Shield, UserCheck, Sun, Moon } from "lucide-react";
import { useAuthStore } from "@/lib/store/auth-store";
import { cn } from "@/lib/utils";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("theme") || "dark";
    setTheme(saved as "dark" | "light");
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  useEffect(() => {
    if (!ready) return;
    if (!user) { router.push("/login"); return; }
    if (user.role !== "admin") { router.push("/"); return; }
    setAllowed(true);
  }, [user, ready, router]);

  if (!ready || allowed === null) {
    return <div className="min-h-screen bg-dark flex items-center justify-center"><Loader2 className="h-6 w-6 text-lime animate-spin" /></div>;
  }
  if (!allowed) return null;

  const links = [
    { href: "/admin", icon: LayoutDashboard, label: "Dashboard", exact: true },
    { href: "/admin/users", icon: Users, label: "Foydalanuvchilar" },
    { href: "/admin/trainers", icon: UserCheck, label: "Trenerlar" },
    { href: "/admin/payouts", icon: Wallet, label: "Pul yechish" },
    { href: "/admin/admins", icon: Shield, label: "Adminlar" },
  ];

  return (
    <div className="min-h-screen bg-dark">
      <div className="border-b border-white/[0.06] bg-dark-surface sticky top-0 z-30">
        <div className="container-main flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-white/40 hover:text-white" title="Saytga qaytish"><ArrowLeft className="h-4 w-4" /></Link>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-lime" />
              <span className="text-sm font-bold text-lime">Admin Panel</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="p-2 rounded-lg text-white/30 hover:text-lime hover:bg-lime-subtle transition-colors" title={theme === "dark" ? "Kunduzgi rejim" : "Tungi rejim"}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <span className="text-xs text-white/40 hidden sm:inline">{user?.full_name}</span>
          </div>
        </div>
      </div>

      <div className="container-main flex gap-6 py-6">
        <aside className="hidden md:block w-56 shrink-0">
          <nav className="space-y-1 sticky top-20">
            {links.map((l) => <AdminLink key={l.href} {...l} pathname={pathname} />)}
          </nav>
        </aside>

        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-dark-surface border-t border-white/[0.06] pb-safe">
          <nav className="grid grid-cols-5 gap-1 p-2">
            {links.map((l) => <AdminLinkMobile key={l.href} {...l} pathname={pathname} />)}
          </nav>
        </div>

        <main className="flex-1 min-w-0 pb-24 md:pb-0">{children}</main>
      </div>
    </div>
  );
}

function AdminLink({ href, icon: Icon, label, exact, pathname }: any) {
  const isActive = exact ? pathname === href : pathname.startsWith(href);
  return (
    <Link href={href} className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
      isActive ? "bg-lime-muted text-lime font-semibold" : "text-white/60 hover:text-white hover:bg-white/[0.04]")}>
      <Icon className="h-4 w-4" />{label}
    </Link>
  );
}

function AdminLinkMobile({ href, icon: Icon, label, exact, pathname }: any) {
  const isActive = exact ? pathname === href : pathname.startsWith(href);
  const shortLabel = label === "Foydalanuvchilar" ? "Userlar" : label === "Pul yechish" ? "To'lovlar" : label;
  return (
    <Link href={href} className={cn("flex flex-col items-center gap-1 py-1.5 rounded-lg text-[9px] transition-colors",
      isActive ? "text-lime font-semibold" : "text-white/40")}>
      <Icon className={cn("transition-all", isActive ? "h-5 w-5" : "h-[18px] w-[18px]")} strokeWidth={isActive ? 2.5 : 2} />
      <span className="leading-none">{shortLabel}</span>
    </Link>
  );
}
