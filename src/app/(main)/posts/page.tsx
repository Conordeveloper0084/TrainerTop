"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Heart, MessageCircle, Share2, Send, Plus, X, ChevronLeft, ChevronRight, Image as ImageIcon, Loader2, Camera, Eye } from "lucide-react";
import { toast } from "sonner";
import { cn, getInitials, timeAgo } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/auth-store";

export default function PostsPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [newComment, setNewComment] = useState("");
  const [viewMode, setViewMode] = useState<"feed" | "my">("feed");
  const [showCreate, setShowCreate] = useState(false);
  const user = useAuthStore((s) => s.user);
  const likeTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const viewedPosts = useRef(new Set<string>());

  // View tracking — har post faqat 1 marta hisoblanadi per session
  const trackView = useCallback((postId: string) => {
    if (viewedPosts.current.has(postId)) return;
    viewedPosts.current.add(postId);
    // 2 soniya kechiktirish — tez scroll qilsa hisoblamaslik uchun
    setTimeout(() => {
      fetch(`/api/posts/${postId}/view`, { method: "POST" }).catch(() => {});
    }, 2000);
  }, []);

  useEffect(() => { fetchPosts(); }, []);
  const fetchPosts = async () => { try { const res = await fetch("/api/posts"); const data = await res.json(); setPosts(Array.isArray(data) ? data : []); } catch (e) {} finally { setLoading(false); } };

  const toggleLike = useCallback(async (postId: string) => {
    if (!user) { window.location.href = "/login"; return; }
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, is_liked: !p.is_liked, likes_count: p.is_liked ? (p.likes_count || 1) - 1 : (p.likes_count || 0) + 1 } : p));
    if (likeTimers.current[postId]) clearTimeout(likeTimers.current[postId]);
    likeTimers.current[postId] = setTimeout(async () => { await fetch(`/api/posts/${postId}/like`, { method: "POST" }); }, 500);
  }, [user]);

  const loadComments = async (postId: string) => { const res = await fetch(`/api/posts/${postId}/comments`); const data = await res.json(); setComments((p) => ({ ...p, [postId]: Array.isArray(data) ? data : [] })); };
  const toggleComments = (postId: string) => { if (openComments === postId) { setOpenComments(null); return; } setOpenComments(postId); if (!comments[postId]) loadComments(postId); };
  const addComment = async (postId: string) => {
    if (!user || !newComment.trim()) return;
    const res = await fetch(`/api/posts/${postId}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: newComment.trim() }) });
    if (res.ok) { const c = await res.json(); setComments((p) => ({ ...p, [postId]: [...(p[postId] || []), c] })); setPosts((p) => p.map((x) => x.id === postId ? { ...x, comments_count: (x.comments_count || 0) + 1 } : x)); setNewComment(""); }
  };
  const handleShare = async (postId: string, name: string) => { const url = `${window.location.origin}/posts#${postId}`; if (navigator.share) { try { await navigator.share({ title: name, url }); } catch {} } else { await navigator.clipboard.writeText(url); toast.success("Havola nusxalandi!"); } };

  const myPosts = posts.filter((p) => (p.user_id || p.trainer_id) === user?.id);
  const displayPosts = viewMode === "my" ? myPosts : posts;

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 text-lime animate-spin" /></div>;

  return (
    <div className="container-main py-8">
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="text-h1 mb-2">Postlar</h1><p className="text-white/40 text-sm">Natijalar, mashqlar va motivatsiya</p></div>
        {user && <button onClick={() => setShowCreate(true)} className="btn-lime !py-2.5 !px-5 text-sm flex items-center gap-2"><Plus className="h-4 w-4" />Post yaratish</button>}
      </div>
      {user && (
        <div className="flex gap-2 mb-6">
          <button onClick={() => setViewMode("feed")} className={cn("px-4 py-2 rounded-lg text-sm", viewMode === "feed" ? "bg-lime-muted text-lime" : "text-white/40")}>Barchasi</button>
          <button onClick={() => setViewMode("my")} className={cn("px-4 py-2 rounded-lg text-sm", viewMode === "my" ? "bg-lime-muted text-lime" : "text-white/40")}>Postlarim</button>
        </div>
      )}
      {showCreate && <CreatePostModal onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); fetchPosts(); }} />}
      <div className="max-w-xl mx-auto space-y-4">
        {displayPosts.length === 0 ? (
          <div className="card p-12 text-center"><p className="text-sm text-white/40 mb-4">{posts.length === 0 ? "Hali postlar yo'q" : "Sizda postlar yo'q"}</p>{user && <button onClick={() => setShowCreate(true)} className="btn-lime !py-2 !px-5 text-sm">Post yaratish</button>}</div>
        ) : displayPosts.map((post) => (
          <PostCard key={post.id} post={post} onView={trackView} onLike={toggleLike} onComment={toggleComments} onShare={handleShare}
            openComments={openComments} comments={comments} newComment={newComment} setNewComment={setNewComment} addComment={addComment} user={user} />
        ))}
      </div>
    </div>
  );
}

function PostCard({ post, onView, onLike, onComment, onShare, openComments, comments, newComment, setNewComment, addComment, user }: any) {
  const cardRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver — post ko'ringanda view hisoblanadi
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { onView(post.id); observer.disconnect(); }
    }, { threshold: 0.5 }); // 50% ko'rinsa hisoblanadi
    observer.observe(el);
    return () => observer.disconnect();
  }, [post.id, onView]);

  return (
    <div ref={cardRef} className="card overflow-hidden">
      <div className="flex items-center gap-3 p-4 pb-3">
        <Link href={post.profiles?.role === "trainer" ? `/trainers/${post.user_id || post.trainer_id}` : "#"} className="w-10 h-10 rounded-full bg-dark-card flex items-center justify-center overflow-hidden">
          {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-white/20">{getInitials(post.profiles?.full_name || "")}</span>}
        </Link>
        <div className="flex-1"><span className="text-sm font-medium">{post.profiles?.full_name}</span>{post.profiles?.role === "trainer" && <span className="ml-1.5 text-[8px] bg-lime-muted text-lime px-1.5 py-0.5 rounded-full">Trener</span>}<p className="text-[10px] text-white/30">{timeAgo(post.created_at)}</p></div>
      </div>
      {post.images?.length > 0 ? <Carousel images={post.images} /> : <div className="w-full aspect-square bg-dark-card flex items-center justify-center"><ImageIcon className="h-10 w-10 text-white/[0.04]" /></div>}
      <div className="p-4">
        <div className="flex items-center gap-4 mb-3">
          <button onClick={() => onLike(post.id)} className="flex items-center gap-1.5 group"><Heart className={cn("h-5 w-5 transition-all", post.is_liked ? "text-red-500 fill-red-500" : "text-white/40 group-hover:text-white/60")} /><span className="text-xs text-white/40">{post.likes_count || 0}</span></button>
          <button onClick={() => onComment(post.id)} className="flex items-center gap-1.5 text-white/40 hover:text-white/60"><MessageCircle className="h-5 w-5" /><span className="text-xs">{post.comments_count || 0}</span></button>
          <span className="flex items-center gap-1 text-white/20"><Eye className="h-4 w-4" /><span className="text-xs">{post.views_count || 0}</span></span>
          <button onClick={() => onShare(post.id, post.profiles?.full_name)} className="ml-auto text-white/30 hover:text-lime"><Share2 className="h-4 w-4" /></button>
        </div>
        {post.caption && <p className="text-sm text-white/60"><span className="font-medium text-white">{post.profiles?.full_name}</span>{" "}{post.caption}</p>}
        {openComments === post.id && (
          <div className="mt-4 pt-4 border-t border-white/[0.06] animate-fade-in">
            <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
              {(comments[post.id] || []).length === 0 ? <p className="text-xs text-white/20 text-center py-4">Hali izoh yo'q</p> : (comments[post.id] || []).map((c: any) => (
                <div key={c.id} className="flex gap-2.5"><div className="w-7 h-7 rounded-full bg-dark-elevated flex items-center justify-center shrink-0"><span className="text-[9px] font-bold text-white/15">{getInitials(c.profiles?.full_name || "")}</span></div><div><p className="text-xs"><span className="font-medium text-white/70">{c.profiles?.full_name}</span> <span className="text-white/50">{c.content}</span></p></div></div>
              ))}
            </div>
            {user && <div className="flex items-center gap-2"><input type="text" value={newComment} onChange={(e: any) => setNewComment(e.target.value)} onKeyDown={(e: any) => { if (e.key === "Enter") addComment(post.id); }} placeholder="Izoh yozing..." className="input-field !py-2 text-xs flex-1" /><button onClick={() => addComment(post.id)} disabled={!newComment.trim()} className="btn-lime !p-2 disabled:opacity-30"><Send className="h-3.5 w-3.5" /></button></div>}
          </div>
        )}
      </div>
    </div>
  );
}

function Carousel({ images }: { images: string[] }) {
  const [cur, setCur] = useState(0);
  const ts = useRef(0);
  return (
    <div className="relative w-full aspect-square overflow-hidden bg-dark-card" onTouchStart={(e) => { ts.current = e.touches[0].clientX; }} onTouchEnd={(e) => { const d = ts.current - e.changedTouches[0].clientX; if (d > 50 && cur < images.length - 1) setCur(cur + 1); if (d < -50 && cur > 0) setCur(cur - 1); }}>
      <div className="flex h-full transition-transform duration-300" style={{ transform: `translateX(-${cur * 100}%)` }}>{images.map((img, i) => <div key={i} className="w-full h-full shrink-0"><img src={img} alt="" className="w-full h-full object-cover" /></div>)}</div>
      {images.length > 1 && (<>{cur > 0 && <button onClick={() => setCur(cur - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-dark/70 flex items-center justify-center text-white/70"><ChevronLeft className="h-4 w-4" /></button>}{cur < images.length - 1 && <button onClick={() => setCur(cur + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-dark/70 flex items-center justify-center text-white/70"><ChevronRight className="h-4 w-4" /></button>}<div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">{images.map((_, i) => <div key={i} className={cn("rounded-full", i === cur ? "w-2 h-2 bg-lime" : "w-1.5 h-1.5 bg-white/40")} />)}</div><div className="absolute top-3 right-3 bg-dark/70 rounded-full px-2.5 py-1 text-[10px] text-white/70">{cur + 1}/{images.length}</div></>)}
    </div>
  );
}

function CreatePostModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [caption, setCaption] = useState("");
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const addRef = useRef<HTMLInputElement>(null);
  const initRef = useRef<HTMLInputElement>(null);

  const addImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = 5 - previews.length;
    const newFiles = files.slice(0, remaining).filter((f) => f.type.startsWith("image/"));
    setPreviews((p) => [...p, ...newFiles.map((f) => ({ file: f, url: URL.createObjectURL(f) }))]);
    e.target.value = "";
  };

  const removeImage = (i: number) => {
    setPreviews((p) => { URL.revokeObjectURL(p[i].url); return p.filter((_, idx) => idx !== i); });
  };

  const handleSubmit = async () => {
    if (!caption.trim() && previews.length === 0) { toast.error("Rasm yoki matn kerak"); return; }
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const img of previews) {
        const formData = new FormData();
        formData.append("file", img.file);
        formData.append("bucket", "posts");
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (res.ok) { const { url } = await res.json(); urls.push(url); }
      }
      const res = await fetch("/api/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caption: caption.trim(), images: urls }) });
      if (res.ok) { toast.success("Post yaratildi!"); onDone(); } else { toast.error("Xatolik"); }
    } catch (e) { toast.error("Xatolik"); } finally { setUploading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="bg-dark-surface border border-white/[0.08] rounded-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]"><h3 className="font-semibold text-sm">Yangi post</h3><button onClick={onClose} className="text-white/40 hover:text-white"><X className="h-5 w-5" /></button></div>
        <div className="p-4 space-y-4">
          {previews.length > 0 ? (
            <div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {previews.map((img, i) => (
                  <div key={i} className="relative w-28 h-28 rounded-lg overflow-hidden shrink-0 group">
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => removeImage(i)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-dark/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-3 w-3 text-white" /></button>
                    <span className="absolute bottom-1 left-1 text-[8px] bg-dark/70 rounded px-1 text-white/50">{i + 1}</span>
                  </div>
                ))}
                {previews.length < 5 && (
                  <button onClick={() => addRef.current?.click()} className="w-28 h-28 rounded-lg border-2 border-dashed border-white/10 hover:border-lime/30 flex flex-col items-center justify-center shrink-0 transition-colors">
                    <Camera className="h-5 w-5 text-white/20 mb-1" /><span className="text-[9px] text-white/20">Qo'shish</span>
                  </button>
                )}
              </div>
              <p className="text-[10px] text-white/20 mt-1">{previews.length}/5 rasm</p>
              <input ref={addRef} type="file" accept="image/*" multiple onChange={addImages} className="hidden" />
            </div>
          ) : (
            <div>
              <button onClick={() => initRef.current?.click()} className="w-full aspect-[16/10] rounded-xl border-2 border-dashed border-white/10 hover:border-lime/30 transition-colors flex flex-col items-center justify-center cursor-pointer">
                <Camera className="h-10 w-10 text-white/15 mb-3" />
                <p className="text-sm text-white/30 mb-1">Rasm tanlang</p>
                <p className="text-[10px] text-white/15">5 tagacha · JPG, PNG</p>
              </button>
              <input ref={initRef} type="file" accept="image/*" multiple onChange={addImages} className="hidden" />
            </div>
          )}
          <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Natijangiz haqida yozing..." rows={3} className="input-field resize-none text-sm" maxLength={500} />
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-white/20">{caption.length}/500</span>
            <button onClick={handleSubmit} disabled={(!caption.trim() && previews.length === 0) || uploading} className="btn-lime !py-2 !px-6 text-sm disabled:opacity-30 flex items-center gap-2">
              {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{uploading ? "Yuklanmoqda..." : "Joylash"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
