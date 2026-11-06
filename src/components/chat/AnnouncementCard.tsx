"use client";

import Link from "next/link";
import { ExternalLink, Megaphone, User, Dumbbell, Eye, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { formatLessonPrice } from "@/lib/utils";
import { UUID_RE } from "@/lib/db-errors";
import { safeLink, isExternalLink, type AnnouncementItem } from "@/lib/announcements";
import { PostMedia } from "@/components/posts/PostMedia";

type ItemProp = Pick<AnnouncementItem, "kind" | "title" | "body" | "image_url" | "link_url" | "link_label" | "created_at">
  & Partial<Pick<AnnouncementItem, "id" | "video_url" | "video_thumbnail_url" | "video_duration" | "edited_at" | "views_count" | "comments_count">>
  & { lesson?: AnnouncementItem["lesson"] };
interface Props {
  item: ItemProp; onOpenImage?: (url: string) => void; preview?: boolean;
  canManage?: boolean; onEdit?: () => void; onDelete?: () => void; onComments?: () => void;
}

const fmtCount = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n % 1000 >= 100 ? 1 : 0)}K` : String(n));

// Rasmiy kanal xabari: sarlavha (ixtiyoriy), matn, rasm/video va tugma. Matn faqat MATN sifatida chiqadi (HTML emas). Havola qayta tekshiriladi.
// Kanal posti (kind='all', boost emas) bo'lsa: ko'rishlar soni, izohlar tugmasi. Admin bo'lsa: tahrirlash/o'chirish (group-hover bilan chiqadi).
export function AnnouncementCard({ item, onOpenImage, preview, canManage, onEdit, onDelete, onComments }: Props) {
  const href = safeLink(item.link_url);
  const label = item.link_label || "Ochish";
  // Boost qilingan darslik: kartochka darslik ma'lumoti bilan (bitta havola — darslik sahifasiga)
  const lesson = item.lesson && UUID_RE.test(item.lesson.id) ? item.lesson : null;
  const price = lesson ? formatLessonPrice(lesson as any) : null;
  const hasMedia = !!(item.image_url || item.video_url);
  const isChannelPost = item.kind === "all" && !lesson;
  const canEditDelete = !!canManage && isChannelPost;
  return (
    <article className="group relative max-w-[88%] sm:max-w-md bg-dark-card rounded-2xl rounded-tl-md p-4 border border-white/[0.05]" data-testid="announcement-card">
      {canEditDelete && (
        <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-60 sm:opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-opacity">
          <button onClick={onEdit} aria-label="Postni tahrirlash" title="Tahrirlash" className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-lime"><Pencil className="h-3.5 w-3.5" /></button>
          <button onClick={onDelete} aria-label="Postni o'chirish" title="O'chirish" className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      )}
      {item.kind === "user" && <p className="text-[10px] text-lime/80 flex items-center gap-1 mb-1.5"><User className="h-3 w-3" />Sizga shaxsiy xabar</p>}
      {lesson ? <p className="text-[10px] font-semibold text-lime mb-2 tracking-wide">TAVSIYA ETILGAN DARSLIK</p> : item.title && <h3 className="text-sm font-semibold mb-1.5 break-words pr-10">{item.title}</h3>}
      {lesson && (
        <Link href={`/lessons/${lesson.id}`} data-testid="lesson-block" className="block rounded-xl overflow-hidden border border-white/[0.08] hover:border-lime/40 transition-colors mb-3">
          {lesson.cover_image_url ? <img src={lesson.cover_image_url} alt="" className="w-full h-36 object-cover" />
            : <div className="w-full h-24 bg-gradient-to-br from-lime/[0.06] to-dark flex items-center justify-center"><Dumbbell className="h-7 w-7 text-lime/20" /></div>}
          <div className="p-3">
            <p className="text-sm font-semibold line-clamp-2 break-words">{lesson.title}</p>
            {lesson.trainer_name && <p className="text-[11px] text-white/40 mt-0.5">{lesson.trainer_name}</p>}
            <p className="text-lime font-bold text-sm mt-1.5">{price?.display}{price?.sub ? <span className="text-[10px] text-white/40 font-normal ml-1">{price.sub}</span> : null}</p>
            <span className="mt-2.5 inline-block btn-lime !py-1.5 !px-4 text-xs">{item.link_label || "Darslikni ko'rish"}</span>
          </div>
        </Link>
      )}
      {!lesson && hasMedia && (
        item.video_url
          ? <div className="mb-2 rounded-xl overflow-hidden"><PostMedia post={{ video_url: item.video_url, video_thumbnail_url: item.video_thumbnail_url, video_duration: item.video_duration, images: [] }} /></div>
          : <button type="button" onClick={() => onOpenImage?.(item.image_url as string)} aria-label="Rasmni kattalashtirish" className="block mb-2 rounded-xl overflow-hidden">
              <img src={item.image_url as string} alt="" className="w-full max-h-64 object-cover" />
            </button>
      )}
      {item.body && <p className="text-sm text-white/70 whitespace-pre-line break-words">{item.body}</p>}
      {href && !lesson && (isExternalLink(href)
        ? <a href={href} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 btn-lime !py-2 !px-4 text-xs">{label}<ExternalLink className="h-3 w-3" /></a>
        : <Link href={href} className="mt-3 inline-flex items-center gap-1.5 btn-lime !py-2 !px-4 text-xs">{label}</Link>)}
      <div className="flex items-center gap-3 mt-2 text-[10px] text-white/25">
        <span className="flex items-center gap-1"><Megaphone className="h-2.5 w-2.5" />{preview ? "Ko'rinishi (namuna)" : new Date(item.created_at).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
        {item.edited_at && <span>tahrirlangan</span>}
        {isChannelPost && !preview && (
          <span className="ml-auto flex items-center gap-3">
            <span className="flex items-center gap-1" title="Ko'rishlar soni"><Eye className="h-3 w-3" />{fmtCount(item.views_count || 0)}</span>
            <button onClick={onComments} className="flex items-center gap-1 hover:text-lime transition-colors" aria-label="Izohlar">
              <MessageCircle className="h-3 w-3" />{fmtCount(item.comments_count || 0)}
            </button>
          </span>
        )}
      </div>
    </article>
  );
}
