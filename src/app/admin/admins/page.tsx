"use client";

import { useEffect, useState } from "react";
import { Shield, Trash2, Plus, Loader2, Calendar, Mail } from "lucide-react";
import { toast } from "sonner";
import { getInitials, cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/auth-store";

export default function AdminAdminsPage() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const currentUser = useAuthStore((s) => s.user);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users?role=admin");
      if (res.ok) setAdmins(await res.json());
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchAdmins(); }, []);

  const removeAdmin = async (user_id: string, name: string) => {
    if (user_id === currentUser?.id) { toast.error("O'zingizni admin'dan olib tashlay olmaysiz"); return; }
    if (!confirm(`${name} adminlikdan olib tashlanadi (oddiy user bo'ladi). Davom etasizmi?`)) return;
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id, role: "user" }),
      });
      if (res.ok) { toast.success("Admin'dan olib tashlandi"); fetchAdmins(); }
      else toast.error("Xatolik");
    } catch { toast.error("Xatolik"); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Adminlar</h1>
          <p className="text-sm text-white/40">{admins.length} ta admin</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-lime !py-2 !px-4 text-sm flex items-center gap-2">
          <Plus className="h-4 w-4" />Admin qo'shish
        </button>
      </div>

      {/* Info */}
      <div className="card p-4 border-yellow-500/20 bg-yellow-500/[0.02]">
        <div className="flex items-start gap-3">
          <Shield className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-yellow-500 mb-1">Diqqat</p>
            <p className="text-[11px] text-white/60 leading-relaxed">Admin barcha ma'lumotlarga to'liq kirish huquqiga ega. Admin qo'shishdan oldin shaxsga ishonch hosil qiling. O'zingizni admin ro'yxatidan chiqara olmaysiz — boshqa admin orqali qilinadi.</p>
          </div>
        </div>
      </div>

      {/* Adminlar ro'yxati */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 text-lime animate-spin" /></div>
      ) : admins.length === 0 ? (
        <div className="card p-8 text-center"><p className="text-white/40 text-sm">Admin yo'q</p></div>
      ) : (
        <div className="space-y-3">
          {admins.map((a) => (
            <div key={a.id} className="card p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-lime/10 flex items-center justify-center shrink-0 overflow-hidden border-2 border-lime/30">
                {a.avatar_url ? <img src={a.avatar_url} alt="" className="w-full h-full object-cover" /> : <Shield className="h-5 w-5 text-lime" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold truncate">{a.full_name}</p>
                  {a.id === currentUser?.id && <span className="text-[9px] bg-lime/20 text-lime px-1.5 py-0.5 rounded-full font-bold">SIZ</span>}
                </div>
                <div className="flex items-center gap-3 text-[10px] text-white/40 mt-0.5">
                  <span className="flex items-center gap-1"><Mail className="h-2.5 w-2.5" />{a.email}</span>
                  <span className="flex items-center gap-1"><Calendar className="h-2.5 w-2.5" />{new Date(a.created_at).toLocaleDateString("uz-UZ")}</span>
                </div>
              </div>
              {a.id !== currentUser?.id && (
                <button onClick={() => removeAdmin(a.id, a.full_name)} className="p-2 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-400/[0.06] transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showAddModal && <AddAdminModal onClose={() => setShowAddModal(false)} onDone={() => { setShowAddModal(false); fetchAdmins(); }} />}
    </div>
  );
}

function AddAdminModal({ onClose, onDone }: any) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/users?search=${encodeURIComponent(search)}`);
        if (res.ok) {
          const data = await res.json();
          setResults((data || []).filter((u: any) => u.role !== "admin").slice(0, 10));
        }
      } catch {} finally { setLoading(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const makeAdmin = async (user_id: string, name: string) => {
    if (!confirm(`${name} admin qilinadi. To'g'rimi?`)) return;
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id, role: "admin" }),
      });
      if (res.ok) { toast.success("Admin qilindi"); onDone(); }
      else toast.error("Xatolik");
    } catch { toast.error("Xatolik"); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="bg-dark-surface border border-white/[0.08] rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-1">Admin qo'shish</h2>
        <p className="text-xs text-white/40 mb-5">Foydalanuvchini qidiring va admin qiling</p>

        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ism yoki email..." autoFocus className="input-field mb-4" />

        <div className="max-h-72 overflow-y-auto space-y-2">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 text-lime animate-spin" /></div>
          ) : results.length === 0 ? (
            <p className="text-center text-xs text-white/30 py-8">{search ? "Topilmadi" : "Qidiruv kiriting"}</p>
          ) : (
            results.map((u) => (
              <button key={u.id} onClick={() => makeAdmin(u.id, u.full_name)} className="w-full flex items-center gap-3 p-3 rounded-lg bg-dark-card hover:bg-lime/10 hover:border-lime/30 border border-transparent transition-all text-left">
                <div className="w-9 h-9 rounded-full bg-dark-elevated flex items-center justify-center shrink-0 overflow-hidden">
                  {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-white/20">{getInitials(u.full_name)}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.full_name}</p>
                  <p className="text-[10px] text-white/40 truncate">{u.email}</p>
                </div>
                <span className="text-[9px] text-white/30 uppercase">{u.role}</span>
              </button>
            ))
          )}
        </div>

        <button onClick={onClose} className="btn-outline w-full mt-5 text-sm">Bekor qilish</button>
      </div>
    </div>
  );
}
