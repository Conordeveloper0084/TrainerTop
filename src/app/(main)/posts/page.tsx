"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Heart, MessageCircle, Share2, Send, Plus, X, Image as ImageIcon, Loader2, Camera, Eye, Trash2, Video } from "lucide-react";
import { toast } from "sonner";
import { cn, getInitials, timeAgo } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/auth-store";
import { PostMedia } from "@/components/posts/PostMedia";
import { AthleteBadge } from "@/components/ui/AthleteBadge";
import { hasViewedPost, markViewedPost } from "@/lib/viewed-posts";
import {
  uploadImage, uploadPoster, uploadVideoDirect, validateVideoFile, getVideoMeta, captureVideoPoster,
  formatDuration, formatBytes, type VideoMeta,
} from "@/lib/upload";
import { VIDEO_POST_MAX_SECONDS, VIDEO_POST_MAX_BYTES, VIDEO_UPLOAD_ROLES } from "@/lib/constants";

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
    if (viewedPosts.current.has(postId) || hasViewedPost(postId)) return;
    viewedPosts.current.add(postId);
    // 2 soniya kechiktirish — tez scroll qilsa hisoblamaslik uchun
    setTimeout(() => {
      markViewedPost(postId);
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

  const deletePost = useCallback(async (postId: string) => {
    if (!window.confirm("Postni o'chirasizmi? Bu amalni qaytarib bo'lmaydi.")) return;
    const res = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
    if (res.ok) { setPosts((prev) => prev.filter((p) => p.id !== postId)); toast.success("Post o'chirildi"); }
    else { const d = await res.json().catch(() => ({})); toast.error(d.message || "O'chirib bo'lmadi"); }
  }, []);

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
          <PostCard key={post.id} post={post} onView={trackView} onLike={toggleLike} onComment={toggleComments} onShare={handleShare} onDelete={deletePost}
            openComments={openComments} comments={comments} newComment={newComment} setNewComment={setNewComment} addComment={addComment} user={user} />
        ))}
      </div>
    </div>
  );
}

function PostCard({ post, onView, onLike, onComment, onShare, onDelete, openComments, comments, newComment, setNewComment, addComment, user }: any) {
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
        <Link href={post.profiles?.role === "trainer" ? `/trainers/${post.user_id || post.trainer_id}` : `/athletes/${post.user_id || post.trainer_id}`} className="w-10 h-10 rounded-full bg-dark-card flex items-center justify-center overflow-hidden">
          {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-white/20">{getInitials(post.profiles?.full_name || "")}</span>}
        </Link>
        <div className="flex-1"><Link href={post.profiles?.role === "trainer" ? `/trainers/${post.user_id || post.trainer_id}` : `/athletes/${post.user_id || post.trainer_id}`} className="text-sm font-medium hover:text-lime transition-colors">{post.profiles?.full_name}</Link>{post.profiles?.is_verified && <AthleteBadge size={15} kind={post.profiles?.badge_kind === "athlete" ? "athlete" : "trainer"} className="ml-1 align-[-2px]" />}{post.profiles?.role === "trainer" && <span className="ml-1.5 text-[8px] bg-lime-muted text-lime px-1.5 py-0.5 rounded-full">Trener</span>}<p className="text-[10px] text-white/30">{timeAgo(post.created_at)}</p></div>
        {(user?.id === (post.user_id || post.trainer_id) || user?.role === "admin") && (
          <button onClick={() => onDelete(post.id)} className="p-2 text-white/20 hover:text-red-400 transition-colors" title="O'chirish"><Trash2 className="h-4 w-4" /></button>
        )}
      </div>
      {post.video_url || post.images?.length > 0 ? <PostMedia post={post} /> : <div className="w-full aspect-square bg-dark-card flex items-center justify-center"><ImageIcon className="h-10 w-10 text-white/[0.04]" /></div>}
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

function CreatePostModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const user = useAuthStore((s) => s.user);
  const canVideo = !!user && (VIDEO_UPLOAD_ROLES as readonly string[]).includes(user.role);

  const [caption, setCaption] = useState("");
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([]);
  const [video, setVideo] = useState<{ file: File; url: string; meta: VideoMeta; poster: Blob | null; posterUrl?: string } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const addRef = useRef<HTMLInputElement>(null);
  const initRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const posterPromiseRef = useRef<Promise<Blob | null> | null>(null);

  // Yuklash paytida sahifani yopmaslik haqida ogohlantirish + chiqishda tozalash
  useEffect(() => {
    if (!uploading) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [uploading]);
  useEffect(() => () => { abortRef.current?.abort(); }, []);

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

  const pickVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const err = validateVideoFile(file, VIDEO_POST_MAX_BYTES);
    if (err) { toast.error(err); return; }
    setPreparing(true);
    try {
      const meta = await getVideoMeta(file);
      if (meta.duration > VIDEO_POST_MAX_SECONDS + 0.5) {
        toast.error(`Video ${formatDuration(meta.duration)} — maksimum ${formatDuration(VIDEO_POST_MAX_SECONDS)} bo'lishi kerak`);
        return;
      }
      setVideo({ file, url: URL.createObjectURL(file), meta, poster: null });
      // Muqova orqa fonda olinadi — foydalanuvchi kutib o'tirmaydi
      const pending = captureVideoPoster(file);
      posterPromiseRef.current = pending;
      pending.then((blob) => {
        if (!blob) return;
        setVideo((v) => (v && v.file === file ? { ...v, poster: blob, posterUrl: URL.createObjectURL(blob) } : v));
      });
    } catch (err: any) {
      toast.error(err?.message || "Videoni o'qib bo'lmadi");
    } finally {
      setPreparing(false);
    }
  };

  const removeVideo = () => {
    if (video) { URL.revokeObjectURL(video.url); if (video.posterUrl) URL.revokeObjectURL(video.posterUrl); }
    posterPromiseRef.current = null;
    setVideo(null);
  };

  const requestClose = () => {
    if (uploading && !window.confirm("Yuklash to'xtatiladi. Davom etasizmi?")) return;
    abortRef.current?.abort();
    onClose();
  };

  const hasMedia = previews.length > 0 || !!video;

  const handleSubmit = async () => {
    if (!caption.trim() && !hasMedia) { toast.error("Rasm, video yoki matn kerak"); return; }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setUploading(true);
    setProgress(0);
    try {
      const payload: Record<string, any> = { caption: caption.trim() };

      if (video) {
        setStage("Video yuklanmoqda");
        const videoUrl = await uploadVideoDirect(video.file, { folder: "posts", onProgress: setProgress, signal: ctrl.signal });
        const posterBlob = video.poster ?? (await posterPromiseRef.current);
        const thumb = posterBlob ? await uploadPoster(posterBlob, "posts") : null;
        payload.video_url = videoUrl;
        payload.video_thumbnail_url = thumb;
        payload.video_duration = Math.round(video.meta.duration);
      } else if (previews.length > 0) {
        setStage("Rasmlar yuklanmoqda");
        const urls: string[] = [];
        for (let i = 0; i < previews.length; i++) {
          urls.push(await uploadImage(previews[i].file, "posts"));
          setProgress((i + 1) / previews.length);
        }
        payload.images = urls;
      }

      setStage("Saqlanmoqda");
      const res = await fetch("/api/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || "Post yaratishda xatolik");
      }
      toast.success("Post yaratildi!");
      onDone();
    } catch (e: any) {
      if (e?.code !== "ABORTED" && e?.name !== "AbortError") toast.error(e?.message || "Xatolik");
    } finally {
      setUploading(false);
      abortRef.current = null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={requestClose}>
      <div className="bg-dark-surface border border-white/[0.08] rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]"><h3 className="font-semibold text-sm">Yangi post</h3><button onClick={requestClose} className="text-white/40 hover:text-white"><X className="h-5 w-5" /></button></div>
        <div className="p-4 space-y-4">
          {video ? (
            <div>
              <video src={video.url} poster={video.posterUrl} controls playsInline className="w-full max-h-72 rounded-xl bg-black" />
              <div className="flex items-center justify-between mt-2">
                <p className="text-[11px] text-white/40">{formatDuration(video.meta.duration)} · {formatBytes(video.file.size)}</p>
                {!uploading && <button onClick={removeVideo} className="text-[11px] text-white/40 hover:text-red-400 flex items-center gap-1"><Trash2 className="h-3 w-3" />Olib tashlash</button>}
              </div>
            </div>
          ) : previews.length > 0 ? (
            <div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {previews.map((img, i) => (
                  <div key={i} className="relative w-28 h-28 rounded-lg overflow-hidden shrink-0 group">
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                    {!uploading && <button onClick={() => removeImage(i)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-dark/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-3 w-3 text-white" /></button>}
                    <span className="absolute bottom-1 left-1 text-[8px] bg-dark/70 rounded px-1 text-white/50">{i + 1}</span>
                  </div>
                ))}
                {previews.length < 5 && !uploading && (
                  <button onClick={() => addRef.current?.click()} className="w-28 h-28 rounded-lg border-2 border-dashed border-white/10 hover:border-lime/30 flex flex-col items-center justify-center shrink-0 transition-colors">
                    <Camera className="h-5 w-5 text-white/20 mb-1" /><span className="text-[9px] text-white/20">Qo'shish</span>
                  </button>
                )}
              </div>
              <p className="text-[10px] text-white/20 mt-1">{previews.length}/5 rasm</p>
              <input ref={addRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={addImages} className="hidden" />
            </div>
          ) : (
            <div>
              <div className={cn("grid gap-3", canVideo ? "grid-cols-2" : "grid-cols-1")}>
                <button onClick={() => initRef.current?.click()} className="aspect-[4/3] rounded-xl border-2 border-dashed border-white/10 hover:border-lime/30 transition-colors flex flex-col items-center justify-center cursor-pointer">
                  <Camera className="h-8 w-8 text-white/15 mb-2" />
                  <p className="text-sm text-white/30">Rasm</p>
                  <p className="text-[10px] text-white/15 mt-0.5">5 tagacha</p>
                </button>
                {canVideo && (
                  <button onClick={() => videoRef.current?.click()} disabled={preparing} className="aspect-[4/3] rounded-xl border-2 border-dashed border-white/10 hover:border-lime/30 transition-colors flex flex-col items-center justify-center cursor-pointer disabled:opacity-50">
                    {preparing ? <Loader2 className="h-8 w-8 text-lime animate-spin mb-2" /> : <Video className="h-8 w-8 text-white/15 mb-2" />}
                    <p className="text-sm text-white/30">{preparing ? "Tekshirilmoqda..." : "Video"}</p>
                    <p className="text-[10px] text-white/15 mt-0.5">{formatDuration(VIDEO_POST_MAX_SECONDS)} gacha</p>
                  </button>
                )}
              </div>
              {!canVideo && <p className="text-[10px] text-white/20 mt-2 text-center">Video post faqat trenerlar uchun</p>}
              <input ref={initRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={addImages} className="hidden" />
              <input ref={videoRef} type="file" accept="video/mp4,video/quicktime,video/webm" onChange={pickVideo} className="hidden" />
            </div>
          )}

          <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder={video ? "Video haqida yozing..." : "Natijangiz haqida yozing..."} rows={3} className="input-field resize-none text-sm" maxLength={500} disabled={uploading} />

          {uploading && (
            <div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-lime transition-all duration-200" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
              <p className="text-[11px] text-white/40 mt-1.5">{stage}{stage !== "Saqlanmoqda" ? ` · ${Math.round(progress * 100)}%` : ""}</p>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-[10px] text-white/20">{caption.length}/500</span>
            <button onClick={handleSubmit} disabled={(!caption.trim() && !hasMedia) || uploading || preparing} className="btn-lime !py-2 !px-6 text-sm disabled:opacity-30 flex items-center gap-2">
              {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{uploading ? "Yuklanmoqda..." : "Joylash"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
