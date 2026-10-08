"use client";

import { AthleteBadge } from "@/components/ui/AthleteBadge";
import { useEffect, useState } from "react";
import { Search, Trash2, Shield, User as UserIcon, UserCheck, Loader2, MoreVertical, Ban, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { getInitials, cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/auth-store";
import { BanModal } from "@/components/admin/BanModal";

const fmtDate = (s: string) => new Date(s).toLocaleDateString("uz-UZ", { day: "numeric", month: "short", year: "numeric" });

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [banTarget, setBanTarget] = useState<any | null>(null);
  const currentUser = useAuthStore((s) => s.user);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter === "banned") params.set("status", "banned");
      else if (filter) params.set("role", filter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/users?${params}`);
      if (res.ok) setUsers(await res.json());
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]);
  useEffect(() => {
    const t = setTimeout(fetchUsers, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const call = async (fn: () => Promise<Response>, okMsg: string) => {
    try {
      const res = await fn();
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.message || "Xatolik");
      toast.success(okMsg);
      setMenuOpen(null);
      fetchUsers();
    } catch (e: any) { toast.error(e.message || "Xatolik"); }
  };

  const changeRole = (user_id: string, role: string) => {
    if (!confirm(`Rolni "${role}" ga o'zgartirishni istaysizmi?`)) return;
    call(() => fetch("/api/admin/users", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id, role }) }), "Rol o'zgartirildi");
  };

  // Atlet nishoni (faqat oddiy foydalanuvchilar): qo'lda berish / olib tashlash
  const athleteBadge = (u: any, action: "grant" | "revoke") => {
    const text = action === "grant" ? `${u.full_name} ga "TrainerTop Athlete" nishonini berasizmi? (Obunachi soniga qaramay beriladi)` : `${u.full_name} dan "TrainerTop Athlete" nishonini olib tashlaysizmi? Avtomatik qayta berilmaydi.`;
    if (!confirm(text)) return;
    call(() => fetch(`/api/admin/users/${u.id}/athlete-badge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }), action === "grant" ? "Nishon berildi" : "Nishon olib tashlandi");
  };

  const deleteUser = (user_id: string) => {
    if (user_id === currentUser?.id) { toast.error("O'zingizni o'chira olmaysiz"); return; }
    if (!confirm("Bu user butunlay o'chiriladi. Qayta tiklab bo'lmaydi. Davom etasizmi? (Moliyaviy tarixi bor foydalanuvchini o'chirib bo'lmaydi — uni ban qiling)")) return;
    call(() => fetch(`/api/admin/users?user_id=${user_id}`, { method: "DELETE" }), "O'chirildi");
  };

  const unban = (u: any) => {
    if (!confirm(`${u.full_name} dan banni olib tashlaysizmi?`)) return;
    call(() => fetch(`/api/admin/users/${u.id}/ban`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }), "Ban olib tashlandi");
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold mb-1">Foydalanuvchilar</h1>
        <p className="text-sm text-white/40">{users.length} ta user</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Qidiruv..." className="input-field pl-9" />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          <FilterBtn active={filter === ""} onClick={() => setFilter("")}>Hammasi</FilterBtn>
          <FilterBtn active={filter === "user"} onClick={() => setFilter("user")}>Userlar</FilterBtn>
          <FilterBtn active={filter === "trainer"} onClick={() => setFilter("trainer")}>Trenerlar</FilterBtn>
          <FilterBtn active={filter === "admin"} onClick={() => setFilter("admin")}>Adminlar</FilterBtn>
          <FilterBtn active={filter === "banned"} onClick={() => setFilter("banned")} danger>Ban qilinganlar</FilterBtn>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 text-lime animate-spin" /></div>
      ) : users.length === 0 ? (
        <div className="card p-8 text-center"><p className="text-white/40 text-sm">User topilmadi</p></div>
      ) : (
        <div className="card divide-y divide-white/[0.04]">
          {users.map((u) => (
            <div key={u.id} className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-dark-card flex items-center justify-center shrink-0 overflow-hidden">
                {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-white/20">{getInitials(u.full_name)}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate flex items-center gap-1.5">{u.full_name}{u.athlete_badge && <AthleteBadge size={15} kind="athlete" />}</p>
                <p className="text-xs text-white/40 truncate">{u.email}</p>
                {u.ban && (
                  <p className="text-[10px] text-red-400/90 mt-1 truncate">
                    Ban: {u.ban.reason} · {u.ban.expires_at ? `${fmtDate(u.ban.expires_at)} gacha` : "doimiy"}
                  </p>
                )}
              </div>
              {u.ban && <span className="text-[10px] px-2 py-1 rounded-full font-semibold shrink-0 bg-red-500 text-white">BAN</span>}
              <span className={cn("text-[10px] px-2 py-1 rounded-full font-semibold shrink-0",
                u.role === "admin" ? "bg-red-500/10 text-red-400" : u.role === "trainer" ? "bg-lime-muted text-lime" : "bg-white/[0.06] text-white/40")}>
                {u.role === "admin" ? "ADMIN" : u.role === "trainer" ? "Trener" : "User"}
              </span>
              <div className="relative">
                <button onClick={() => setMenuOpen(menuOpen === u.id ? null : u.id)} className="p-2 rounded-lg hover:bg-white/5 text-white/40">
                  <MoreVertical className="h-4 w-4" />
                </button>
                {menuOpen === u.id && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                    <div className="absolute right-0 top-full mt-1 w-52 bg-dark-surface border border-white/[0.08] rounded-xl shadow-elevated z-50 py-1.5">
                      {u.id !== currentUser?.id && (<>
                        {u.role !== "user" && <MenuItem icon={UserIcon} label="User qilish" onClick={() => changeRole(u.id, "user")} />}
                        {u.role !== "trainer" && <MenuItem icon={UserCheck} label="Trener qilish" onClick={() => changeRole(u.id, "trainer")} />}
                        {u.role !== "admin" && <MenuItem icon={Shield} label="Admin qilish" onClick={() => changeRole(u.id, "admin")} lime />}
                        <div className="border-t border-white/[0.06] my-1" />
                      </>)}
                      {u.role === "user" && (u.athlete_badge
                        ? <MenuItem icon={ShieldCheck} label="Athlete nishonini olib tashlash" onClick={() => athleteBadge(u, "revoke")} />
                        : <MenuItem icon={ShieldCheck} label="Athlete nishonini berish" onClick={() => athleteBadge(u, "grant")} lime />)}
                      {u.role !== "admin" && (u.ban
                        ? <MenuItem icon={ShieldCheck} label="Banni olib tashlash" onClick={() => unban(u)} lime />
                        : <MenuItem icon={Ban} label="Ban berish" onClick={() => { setMenuOpen(null); setBanTarget(u); }} danger />)}
                      {u.role !== "admin" && u.id !== currentUser?.id && <MenuItem icon={Trash2} label="Butunlay o'chirish" onClick={() => deleteUser(u.id)} danger />}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {banTarget && <BanModal user={banTarget} onClose={() => setBanTarget(null)} onDone={() => { setBanTarget(null); fetchUsers(); }} />}
    </div>
  );
}

function FilterBtn({ children, active, onClick, danger }: any) {
  return (
    <button onClick={onClick} className={cn("px-4 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
      active ? (danger ? "bg-red-500 text-white" : "bg-lime text-black") : "bg-dark-surface border border-white/[0.08] text-white/60 hover:bg-white/5")}>
      {children}
    </button>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger, lime }: any) {
  return (
    <button onClick={onClick} className={cn("w-full flex items-center gap-3 px-3 py-2 text-xs transition-colors",
      danger ? "text-red-400 hover:bg-red-400/[0.06]" : lime ? "text-lime hover:bg-lime-subtle" : "text-white/70 hover:bg-white/[0.04]")}>
      <Icon className="h-3.5 w-3.5" />{label}
    </button>
  );
}
