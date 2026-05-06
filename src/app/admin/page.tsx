"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, UserCheck, BookOpen, MessageCircle, Wallet, TrendingUp, Loader2, Clock, ArrowRight, ArrowUpRight } from "lucide-react";
import { formatPrice, getInitials } from "@/lib/utils";

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [recentTrainers, setRecentTrainers] = useState<any[]>([]);
  const [pendingPayouts, setPendingPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, t, p] = await Promise.all([
          fetch("/api/admin/stats").then((r) => r.ok ? r.json() : null),
          fetch("/api/admin/users?role=trainer").then((r) => r.ok ? r.json() : []),
          fetch("/api/admin/payouts?status=pending").then((r) => r.ok ? r.json() : []),
        ]);
        setStats(s);
        setRecentTrainers((t || []).slice(0, 5));
        setPendingPayouts((p || []).slice(0, 5));
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 text-lime animate-spin" /></div>;
  if (!stats) return <div className="card p-8 text-center"><p className="text-white/40">Ma'lumot yuklanmadi</p></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
        <p className="text-sm text-white/40">Platforma statistikasi</p>
      </div>

      {/* Asosiy statistika */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Foydalanuvchilar" value={stats.users} color="text-blue-400" bg="bg-blue-400/10" />
        <StatCard icon={UserCheck} label="Trenerlar" value={stats.trainers} color="text-lime" bg="bg-lime/10" />
        <StatCard icon={BookOpen} label="Darsliklar" value={stats.lessons} color="text-purple-400" bg="bg-purple-400/10" />
        <StatCard icon={MessageCircle} label="Postlar" value={stats.posts} color="text-orange-400" bg="bg-orange-400/10" />
      </div>

      {/* Moliyaviy */}
      <div>
        <h2 className="text-sm font-semibold text-white/60 mb-3">Moliyaviy ko'rsatkichlar</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FinanceCard icon={Wallet} label="Trenerlar balansi" value={formatPrice(stats.total_balance)} sub="Yechishga tayyor" />
          <FinanceCard icon={TrendingUp} label="Jami daromad" value={formatPrice(stats.total_earned)} sub="Platforma tarixida" />
          <FinanceCard icon={Clock} label="Pul yechish" value={stats.pending_payouts.toString()} sub="Kutilayotgan request" alert={stats.pending_payouts > 0} />
        </div>
      </div>

      {/* Pending payouts widget */}
      {pendingPayouts.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between p-5 border-b border-white/[0.04]">
            <div>
              <h2 className="font-semibold text-sm">Kutilayotgan to'lovlar</h2>
              <p className="text-[11px] text-white/40 mt-0.5">Tezroq ko'rib chiqing</p>
            </div>
            <Link href="/admin/payouts" className="text-xs text-lime hover:underline flex items-center gap-1">
              Hammasi <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {pendingPayouts.map((p: any) => (
              <Link key={p.id} href="/admin/payouts" className="flex items-center gap-3 p-4 hover:bg-white/[0.02] transition-colors">
                <div className="w-9 h-9 rounded-full bg-dark-card flex items-center justify-center shrink-0 overflow-hidden">
                  {p.trainer?.avatar_url ? <img src={p.trainer.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-white/20">{getInitials(p.trainer?.full_name || "")}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.trainer?.full_name}</p>
                  <p className="text-[10px] text-white/30">{new Date(p.requested_at).toLocaleString("uz-UZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <p className="text-sm font-bold text-lime shrink-0">{formatPrice(p.amount)}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* So'nggi trenerlar */}
      <div className="card">
        <div className="flex items-center justify-between p-5 border-b border-white/[0.04]">
          <div>
            <h2 className="font-semibold text-sm">So'nggi qo'shilgan trenerlar</h2>
            <p className="text-[11px] text-white/40 mt-0.5">{stats.trainers} ta jami</p>
          </div>
          <Link href="/admin/trainers" className="text-xs text-lime hover:underline flex items-center gap-1">
            Hammasi <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {recentTrainers.length === 0 ? (
          <div className="p-8 text-center"><p className="text-xs text-white/30">Hali trener yo'q</p></div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {recentTrainers.map((t: any) => (
              <div key={t.id} className="flex items-center gap-3 p-4">
                <div className="w-9 h-9 rounded-full bg-dark-card flex items-center justify-center shrink-0 overflow-hidden">
                  {t.avatar_url ? <img src={t.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-white/20">{getInitials(t.full_name)}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.full_name}</p>
                  <p className="text-[10px] text-white/30 truncate">{t.email}</p>
                </div>
                <Link href={`/trainers/${t.id}`} target="_blank" className="text-white/30 hover:text-lime"><ArrowUpRight className="h-4 w-4" /></Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, bg }: any) {
  return (
    <div className="card p-5">
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <p className="text-2xl font-bold mb-1">{value}</p>
      <p className="text-xs text-white/40">{label}</p>
    </div>
  );
}

function FinanceCard({ icon: Icon, label, value, sub, alert }: any) {
  return (
    <div className={`card p-5 ${alert ? "border-yellow-500/30 bg-yellow-500/[0.02]" : ""}`}>
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-xl ${alert ? "bg-yellow-500/10" : "bg-lime/10"} flex items-center justify-center`}>
          <Icon className={`h-5 w-5 ${alert ? "text-yellow-500" : "text-lime"}`} />
        </div>
        <p className="text-xs text-white/40">{label}</p>
      </div>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[10px] text-white/30 mt-1">{sub}</p>
    </div>
  );
}
