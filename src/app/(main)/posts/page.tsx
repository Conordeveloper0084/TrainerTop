"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/auth-store";
import { PostList } from "@/components/posts/PostList";

// Ro'yxat qayta yangilanadigan eng kichik oraliq (sahifaga qaytilganda / tab qayta ochilganda): like soni, holati va obuna
// serverdagi qiymatga almashadi — eski qiymat "qotib" qolmaydi.
const REFRESH_AFTER_MS = 30_000;   // (page.tsx dan faqat default eksport — Next qoidasi)

export default function PostsPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"feed" | "my">("feed");
  const user = useAuthStore((s) => s.user);
  const lastFetch = useRef(0);

  const fetchPosts = useCallback(async () => {
    lastFetch.current = Date.now();
    try {
      const res = await fetch("/api/posts", { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data)) setPosts(data);       // server qiymatlari (like, ko'rishlar, obuna) to'liq almashadi
    } catch { /* tarmoq xatosi — mavjud ro'yxat qoladi */ } finally { setLoading(false); }
  }, []);

  // Kirish/chiqishda (is_liked / is_following foydalanuvchiga bog'liq) va birinchi ochilishda
  useEffect(() => { fetchPosts(); }, [fetchPosts, user?.id]);

  // Tab qayta ko'ringanda (boshqa ilova/tabdan qaytilganda) — ro'yxat yangilanadi
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible" && Date.now() - lastFetch.current > REFRESH_AFTER_MS) fetchPosts(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchPosts]);

  const myPosts = posts.filter((p) => (p.user_id || p.trainer_id) === user?.id);
  const displayPosts = viewMode === "my" ? myPosts : posts;

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 text-lime animate-spin" /></div>;

  return (
    <div className="container-main py-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-page-title">Postlar</h1>
        {user && <Link href="/posts/create" aria-label="Post yaratish" data-testid="create-post-link" className="btn-lime !py-1.5 !px-3 text-sm flex items-center gap-1"><Plus className="h-4 w-4" />Post</Link>}
      </div>
      {user && (
        <div className="flex gap-2 mb-6">
          <button type="button" onClick={() => setViewMode("feed")} className={cn("px-4 py-2 rounded-lg text-sm", viewMode === "feed" ? "bg-lime-muted text-lime" : "text-white/40")}>Barchasi</button>
          <button type="button" onClick={() => setViewMode("my")} className={cn("px-4 py-2 rounded-lg text-sm", viewMode === "my" ? "bg-lime-muted text-lime" : "text-white/40")}>Postlarim</button>
        </div>
      )}
      <div className="max-w-xl mx-auto">
        {displayPosts.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-sm text-white/40 mb-4">{posts.length === 0 ? "Hali postlar yo'q" : "Sizda postlar yo'q"}</p>
            {user && <Link href="/posts/create" className="btn-lime !py-2 !px-5 text-sm inline-block">Post yaratish</Link>}
          </div>
        ) : (
          // setPosts to'liq ro'yxat ustida ishlaydi — "Postlarim" filtrida qilingan like/o'chirish lentada ham aks etadi
          <PostList posts={displayPosts} setPosts={setPosts} user={user} />
        )}
      </div>
    </div>
  );
}
