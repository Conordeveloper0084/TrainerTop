"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Loader2, UserPlus, UserCheck, Heart, MessageCircle, Play } from "lucide-react";
import { toast } from "sonner";
import { getInitials, timeAgo } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/auth-store";
import { AthleteBadge } from "@/components/ui/AthleteBadge";
import { PostMedia } from "@/components/posts/PostMedia";

// Atletning ochiq profili (blog): rasm, nom, nishon, obunachilar, postlar, "Obuna bo'lish"
export default function AthleteProfilePage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const me = useAuthStore((s) => s.user);
  const [data, setData] = useState<any>(null); const [state, setState] = useState<"loading" | "ok" | "notfound">("loading");
  const [following, setFollowing] = useState(false); const [followers, setFollowers] = useState(0); const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/athletes/${id}`); if (!alive) return;
        if (!res.ok) { setState("notfound"); return; }
        const d = await res.json(); if (!alive) return;
        if (d.role === "trainer") { router.replace(`/trainers/${d.id}`); return; }
        setData(d); setFollowing(!!d.is_following); setFollowers(d.followers_count || 0); setState("ok");
      } catch { if (alive) setState("notfound"); }
    })();
    return () => { alive = false; };
  }, [id, me?.id]);   // eslint-disable-line react-hooks/exhaustive-deps

  const toggleFollow = async () => {
    if (!me) { toast.info("Obuna bo'lish uchun tizimga kiring"); return; }
    if (busy) return; setBusy(true);
    try {
      const res = await fetch("/api/follows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trainer_id: id }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.message || "Xatolik"); return; }
      setFollowing(!!d.following); setFollowers(Number(d.followers_count) || 0);
    } catch { toast.error("Xatolik"); } finally { setBusy(false); }
  };

  if (state === "loading") return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 text-lime animate-spin" /></div>;
  if (state === "notfound" || !data) return <div className="container-main py-20 text-center"><p className="text-white/40 text-sm mb-3">Profil topilmadi</p><Link href="/posts" className="text-lime text-sm underline">Postlarga qaytish</Link></div>;

  return (
    <div className="container-main py-8 max-w-2xl">
      <Link href="/posts" className="text-xs text-white/40 hover:text-white flex items-center gap-1 mb-4"><ChevronLeft className="h-3.5 w-3.5" />Postlar</Link>
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-full bg-dark-card flex items-center justify-center overflow-hidden shrink-0">{data.avatar_url ? <img src={data.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xl font-bold text-white/20">{getInitials(data.full_name)}</span>}</div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold flex items-center gap-2 break-words">{data.full_name}{data.athlete_badge && <AthleteBadge size={20} kind="athlete" />}</h1>
            {data.username && <p className="text-sm text-lime/70 mt-0.5">@{data.username}</p>}
            {data.athlete_badge && <div className="mt-1.5"><AthleteBadge label kind="athlete" size={14} /></div>}
            <div className="flex gap-5 mt-3 text-center">
              <div><p className="text-sm font-bold" data-testid="followers-count">{followers}</p><p className="text-[10px] text-white/30">Obunachi</p></div>
              <div><p className="text-sm font-bold" data-testid="posts-count">{data.posts_count}</p><p className="text-[10px] text-white/30">Post</p></div>
            </div>
          </div>
        </div>
        <div className="mt-4">
          {data.is_own
            ? <div className="flex gap-2"><Link href="/posts" className="btn-lime !py-2 !px-5 text-xs">Post joylash</Link><Link href="/profile/followers" className="btn-outline !py-2 !px-5 text-xs">Obunachilarim</Link></div>
            : <button onClick={toggleFollow} disabled={busy} className={`!py-2 !px-5 text-xs flex items-center gap-1.5 disabled:opacity-50 ${following ? "btn-outline" : "btn-lime"}`}>{following ? <UserCheck className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}{following ? "Obuna bo'lingan" : "Obuna bo'lish"}</button>}
        </div>
      </div>

      {data.posts.length === 0 ? <div className="card p-10 text-center"><p className="text-sm text-white/40">Hali postlar yo'q</p></div> : (
        <div className="space-y-4">
          {data.posts.map((p: any) => (
            <div key={p.id} className="card overflow-hidden" data-testid="athlete-post">
              {(p.video_url || p.images?.length > 0) && <PostMedia post={p} />}
              <div className="p-4">
                {p.caption && <p className="text-sm text-white/80 whitespace-pre-line break-words">{p.caption}</p>}
                <p className="text-[10px] text-white/30 mt-2 flex items-center gap-3">{timeAgo(p.created_at)}<span className="flex items-center gap-1"><Heart className="h-3 w-3" />{p.likes_count || 0}</span><span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{p.comments_count || 0}</span>{p.video_url && <span className="flex items-center gap-1"><Play className="h-3 w-3" />Video</span>}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
