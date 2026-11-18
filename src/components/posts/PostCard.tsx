"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Heart, MessageCircle, Share2, Send, Eye, Trash2, MoreVertical, Flag, UserX } from "lucide-react";
import { cn, getInitials, timeAgo } from "@/lib/utils";
import { PostMedia } from "@/components/posts/PostMedia";
import { PostCaption } from "@/components/posts/PostCaption";
import { FollowButton } from "@/components/posts/FollowButton";
import { AthleteBadge } from "@/components/ui/AthleteBadge";
import { trackPostView } from "@/lib/viewed-posts";

// Matn necha qatordan keyin "… yana" bilan qisqaradi (Android/iOS bilan bir xil)
export const CAPTION_LINES_WITH_MEDIA = 3;
export const CAPTION_LINES_TEXT_ONLY = 8;

export const hasPostMedia = (post: { video_url?: string | null; images?: string[] | null }) => !!post.video_url || (Array.isArray(post.images) && post.images.length > 0);
// Muallif bosilganda: trener — trenerlar sahifasidan ochiladigan O'SHA profil sahifasi; aks holda ommaviy (atlet) profil
export const authorHref = (post: any) => { const id = post.user_id || post.trainer_id; return post.profiles?.role === "trainer" ? `/trainers/${id}` : `/athletes/${id}`; };

export interface PostCardProps {
  post: any; user: any;
  onLike: (id: string) => void; onComment: (id: string) => void; onShare: (id: string, name: string) => void; onDelete: (id: string) => void;
  onReport: (id: string) => void; onReportComment: (id: string) => void; onBlock: (authorId: string, name: string) => void;
  openComments: string | null; comments: Record<string, any[]>; newComment: string; setNewComment: (v: string) => void; addComment: (id: string) => void;
}

export function PostCard({ post, user, onLike, onComment, onShare, onDelete, onReport, onReportComment, onBlock, openComments, comments, newComment, setNewComment, addComment }: PostCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const authorId = post.user_id || post.trainer_id;
  const isMine = user?.id === authorId;
  const name = post.profiles?.full_name || "";
  const href = authorHref(post);
  const media = hasPostMedia(post);

  // Post yarmi ko'ringanda "ko'rildi" — sessiyada har post uchun FAQAT BIR MARTA (lib/viewed-posts)
  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { trackPostView(post.id); observer.disconnect(); }
    }, { threshold: 0.5 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [post.id]);

  const actions = (
    <div className="flex items-center gap-4" data-testid="post-actions">
      <button type="button" onClick={() => onLike(post.id)} aria-label={post.is_liked ? "Likeni olib tashlash" : "Like"} aria-pressed={!!post.is_liked} data-testid="like-btn" className="flex items-center gap-1.5 group">
        <Heart className={cn("h-5 w-5 transition-all", post.is_liked ? "text-red-500 fill-red-500" : "text-white/40 group-hover:text-white/60")} /><span className="text-xs text-white/40" data-testid="likes-count">{post.likes_count || 0}</span>
      </button>
      <button type="button" onClick={() => onComment(post.id)} aria-label="Izohlarni ko'rsatish" className="flex items-center gap-1.5 text-white/40 hover:text-white/60"><MessageCircle className="h-5 w-5" /><span className="text-xs">{post.comments_count || 0}</span></button>
      <span className="flex items-center gap-1 text-white/20"><Eye className="h-4 w-4" /><span className="text-xs" data-testid="views-count">{post.views_count || 0}</span></span>
      <button type="button" onClick={() => onShare(post.id, name)} aria-label="Ulashish" className="ml-auto text-white/30 hover:text-lime"><Share2 className="h-4 w-4" /></button>
    </div>
  );

  return (
    <div ref={cardRef} className="card overflow-hidden" data-testid="post-card" data-kind={media ? "media" : "text"}>
      <div className="flex items-center gap-2.5 p-4 pb-3">
        <Link href={href} aria-label={name} className="w-10 h-10 rounded-full bg-dark-card flex items-center justify-center overflow-hidden shrink-0" data-testid="post-author-avatar">
          {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-white/20">{getInitials(name)}</span>}
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <Link href={href} className="text-sm font-medium hover:text-lime transition-colors truncate" data-testid="post-author-name">{name}</Link>
            {post.profiles?.is_verified && <AthleteBadge size={15} kind={post.profiles?.badge_kind === "athlete" ? "athlete" : "trainer"} className="shrink-0" />}
          </div>
          {/* "Trener" belgisi ikkinchi qatorda — tor ekranda ism uchun joy qolsin (yonida "Obuna bo'lish" tugmasi bor) */}
          <p className="text-[10px] text-white/30 flex items-center gap-1.5 mt-0.5">{post.profiles?.role === "trainer" && <span className="text-[9px] leading-none bg-lime-muted text-lime px-1.5 py-[3px] rounded-full">Trener</span>}<span className="truncate">{timeAgo(post.created_at)}</span></p>
        </div>
        {!isMine && authorId && <FollowButton authorId={authorId} initial={!!post.is_following} />}
        {(isMine || user?.role === "admin") && (
          <button type="button" onClick={() => onDelete(post.id)} className="p-2 -mr-2 text-white/20 hover:text-red-400 transition-colors shrink-0" title="O'chirish" aria-label="Postni o'chirish"><Trash2 className="h-4 w-4" /></button>
        )}
        {user && !isMine && (
          <div className="relative shrink-0 -mr-2">
            <button type="button" onClick={() => setMenuOpen((v) => !v)} aria-label="Ko'proq" className="p-2 text-white/20 hover:text-white/50 transition-colors"><MoreVertical className="h-4 w-4" /></button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-dark-surface border border-white/[0.08] rounded-xl shadow-lg py-1 w-44 text-sm">
                <button type="button" onClick={() => { setMenuOpen(false); onReport(post.id); }} className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center gap-2 text-white/70"><Flag className="h-3.5 w-3.5" />Shikoyat qilish</button>
                <button type="button" onClick={() => { setMenuOpen(false); onBlock(authorId, name || "Foydalanuvchi"); }} className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center gap-2 text-red-400"><UserX className="h-3.5 w-3.5" />{name} ni bloklash</button>
              </div>
            )}
          </div>
        )}
      </div>

      {media ? (
        <>
          {/* Rasmli/videoli post: media → tugmalar → matn (muallif ismi qalin + matn, bitta oqimda, kartaning butun eni bo'ylab) */}
          <PostMedia post={post} />
          <div className="px-4 pt-4">{actions}</div>
          {post.caption && <PostCaption text={post.caption} authorName={name} maxLines={CAPTION_LINES_WITH_MEDIA} className="px-4 mt-3" />}
        </>
      ) : (
        <>
          {/* Faqat matnli post: bo'sh rasm joyi YO'Q; matn rasm o'rnida (kattaroq shrift), muallif ismi takrorlanmaydi, tugmalardan YUQORIDA */}
          {post.caption && <PostCaption text={post.caption} maxLines={CAPTION_LINES_TEXT_ONLY} large className="px-4 pt-1" />}
          <div className="px-4 pt-4">{actions}</div>
        </>
      )}

      <div className="px-4 pb-4">
        {openComments === post.id && (
          <div className="mt-4 pt-4 border-t border-white/[0.06] animate-fade-in">
            <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
              {(comments[post.id] || []).length === 0 ? <p className="text-xs text-white/20 text-center py-4">Hali izoh yo'q</p> : (comments[post.id] || []).map((c: any) => (
                <div key={c.id} className="group flex gap-2.5 items-start"><div className="w-7 h-7 rounded-full bg-dark-elevated flex items-center justify-center shrink-0"><span className="text-[9px] font-bold text-white/15">{getInitials(c.profiles?.full_name || "")}</span></div><div className="flex-1 min-w-0"><p className="text-xs break-words"><span className="font-medium text-white/70">{c.profiles?.full_name}</span> <span className="text-white/50">{c.content}</span></p></div>
                  {user && user.id !== c.user_id && <button type="button" onClick={() => onReportComment(c.id)} aria-label="Izohga shikoyat" className="opacity-0 group-hover:opacity-100 transition-opacity text-white/20 hover:text-red-400 shrink-0"><Flag className="h-3 w-3" /></button>}
                </div>
              ))}
            </div>
            {user && <div className="flex items-center gap-2"><input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addComment(post.id); }} placeholder="Izoh yozing..." className="input-field !py-2 text-xs flex-1" /><button type="button" onClick={() => addComment(post.id)} disabled={!newComment.trim()} aria-label="Izohni yuborish" className="btn-lime !p-2 disabled:opacity-30"><Send className="h-3.5 w-3.5" /></button></div>}
          </div>
        )}
      </div>
    </div>
  );
}
