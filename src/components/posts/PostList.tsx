"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import { PostCard } from "@/components/posts/PostCard";
import { ReportDialog } from "@/components/shared/ReportDialog";
import { optimisticLike, serverLike } from "@/lib/post-like";
import { useFollowStore } from "@/lib/store/follow-store";
import type { ModReason } from "@/lib/chat-moderation";

// Postlar ro'yxati — lenta (/posts), trener sahifasi va atlet sahifasi UCHUN BITTA komponent: karta ko'rinishi, like, ko'rishlar,
// obuna holati, izohlar, ulashish, o'chirish, shikoyat va bloklash hamma joyda bir xil ishlaydi.
const defaultNavigate = (url: string) => { window.location.href = url; };

export function PostList({ posts, setPosts, user, navigate = defaultNavigate }: {
  posts: any[]; setPosts: Dispatch<SetStateAction<any[]>>; user: any; navigate?: (url: string) => void;
}) {
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [newComment, setNewComment] = useState("");
  const [reportTarget, setReportTarget] = useState<{ type: "post" | "comment"; id: string } | null>(null);
  const likePending = useRef(new Set<string>());

  // Obuna holati: serverdan kelgan qiymat (is_following) umumiy do'konga yoziladi — shunda bitta postda bosilgan "Obuna bo'lish"
  // shu muallifning boshqa postlarida va profil sahifasida ham darhol ko'rinadi. Ro'yxat yangilansa — server qiymati ustun.
  useEffect(() => {
    const entries = posts.filter((p) => typeof p?.is_following === "boolean").map((p) => [p.user_id || p.trainer_id, p.is_following] as [string, boolean]);
    if (entries.length > 0) useFollowStore.getState().seed(entries);
  }, [posts]);

  // Like: optimistik ±1 FAQAT javob kelguncha, keyin son va holat SERVER javobidan ({ liked, likes_count }).
  // So'rov ketayotganda shu postga qayta bosish e'tiborsiz (ikki parallel toggle serverda tartibsiz bajarilib qolmasin).
  const toggleLike = useCallback(async (postId: string) => {
    if (!user) { navigate("/login"); return; }
    if (likePending.current.has(postId)) return;
    likePending.current.add(postId);
    let before: any = null;
    setPosts((prev) => prev.map((p) => { if (p.id !== postId) return p; before = p; return optimisticLike(p); }));
    const revert = () => setPosts((prev) => prev.map((p) => (p.id === postId && before ? { ...p, is_liked: before.is_liked, likes_count: before.likes_count } : p)));
    try {
      const res = await fetch(`/api/posts/${postId}/like`, { method: "POST" });
      const d: any = await res.json().catch(() => null);
      if (!res.ok || typeof d?.liked !== "boolean") { revert(); if (res.status !== 401) toast.error(d?.message || "Bajarib bo'lmadi"); return; }
      setPosts((prev) => prev.map((p) => (p.id === postId ? serverLike(p, d) : p)));
    } catch {
      revert();
    } finally {
      likePending.current.delete(postId);
    }
  }, [user, setPosts, navigate]);

  const loadComments = async (postId: string) => {
    try {
      const res = await fetch(`/api/posts/${postId}/comments`); const data = await res.json();
      setComments((p) => ({ ...p, [postId]: Array.isArray(data) ? data : [] }));
    } catch { setComments((p) => ({ ...p, [postId]: [] })); }
  };
  const toggleComments = (postId: string) => { if (openComments === postId) { setOpenComments(null); return; } setOpenComments(postId); if (!comments[postId]) loadComments(postId); };
  const addComment = async (postId: string) => {
    if (!user || !newComment.trim()) return;
    const res = await fetch(`/api/posts/${postId}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: newComment.trim() }) });
    if (res.ok) {
      const c = await res.json();
      setComments((p) => ({ ...p, [postId]: [...(p[postId] || []), c] }));
      setPosts((p) => p.map((x) => (x.id === postId ? { ...x, comments_count: (x.comments_count || 0) + 1 } : x)));
      setNewComment("");
    } else { const d = await res.json().catch(() => ({})); toast.error(d.message || "Izoh yuborilmadi"); }
  };

  const handleShare = async (postId: string, name: string) => {
    const url = `${window.location.origin}/posts#${postId}`;
    if (navigator.share) { try { await navigator.share({ title: name, url }); } catch { /* bekor qilindi */ } }
    else { try { await navigator.clipboard.writeText(url); toast.success("Havola nusxalandi!"); } catch { toast.error("Nusxalab bo'lmadi"); } }
  };

  const deletePost = useCallback(async (postId: string) => {
    if (!window.confirm("Postni o'chirasizmi? Bu amalni qaytarib bo'lmaydi.")) return;
    const res = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
    if (res.ok) { setPosts((prev) => prev.filter((p) => p.id !== postId)); toast.success("Post o'chirildi"); }
    else { const d = await res.json().catch(() => ({})); toast.error(d.message || "O'chirib bo'lmadi"); }
  }, [setPosts]);

  // Shikoyat: post yoki izohga
  const submitReport = async (b: { reason: ModReason; note?: string }) => {
    if (!reportTarget) return;
    const res = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target_type: reportTarget.type, target_id: reportTarget.id, ...b }) });
    const d = await res.json().catch(() => ({}));
    if (res.ok) toast.success("Shikoyatingiz yuborildi"); else toast.error(d.message || "Yuborilmadi");
    setReportTarget(null);
  };

  // Bloklash: shu odamning barcha postlari darhol ro'yxatdan yo'qoladi (bir tomonlama)
  const blockAuthor = useCallback(async (authorId: string, name: string) => {
    if (!window.confirm(`${name} ni bloklaysizmi? Uning postlari endi lentangizda ko'rinmaydi.`)) return;
    const res = await fetch("/api/blocks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: authorId }) });
    if (res.ok) { setPosts((prev) => prev.filter((p) => (p.user_id || p.trainer_id) !== authorId)); toast.success(`${name} bloklandi`); }
    else { const d = await res.json().catch(() => ({})); toast.error(d.message || "Bloklab bo'lmadi"); }
  }, [setPosts]);

  return (
    <>
      {reportTarget && <ReportDialog title={reportTarget.type === "post" ? "Postga shikoyat" : "Izohga shikoyat"} onClose={() => setReportTarget(null)} onSubmit={submitReport} />}
      <div className="space-y-4" data-testid="post-list">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} user={user} onLike={toggleLike} onComment={toggleComments} onShare={handleShare} onDelete={deletePost}
            onReport={(id) => setReportTarget({ type: "post", id })} onReportComment={(id) => setReportTarget({ type: "comment", id })} onBlock={blockAuthor}
            openComments={openComments} comments={comments} newComment={newComment} setNewComment={setNewComment} addComment={addComment} />
        ))}
      </div>
    </>
  );
}
