"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Megaphone, Pencil, Camera, Save } from "lucide-react";
import { toast } from "sonner";
import { AnnouncementCard } from "@/components/chat/AnnouncementCard";
import { ChannelComposer, type EditingPost } from "@/components/chat/ChannelComposer";
import { CommentsPanel } from "@/components/chat/CommentsPanel";
import { ImageViewer } from "@/components/chat/ImageViewer";
import { ANNOUNCE_PAGE_SIZE, CHANNEL_NAME_MAX, CHANNEL_BIO_MAX, type AnnouncementItem, type ChannelIdentity } from "@/lib/announcements";
import { useAuthStore } from "@/lib/store/auth-store";
import { getInitials, cn } from "@/lib/utils";
import { uploadImage } from "@/lib/upload";

type View = "feed" | "info" | "comments";

// Rasmiy kanal: oddiy foydalanuvchiga faqat o'qish, adminga yozish/tahrirlash/o'chirish ham bor.
// Nomga/rasmga bosilsa — Telegram kanali kabi bio/profil ko'rinishi ochiladi (admin bo'lsa shu yerdan tahrirlash ham mumkin).
// Umumiy joyga bosilsa — postlar oqimi (feed) ko'rinadi. Har bir postda ko'rishlar soni va izohlar tugmasi bor.
// Birinchi yuklashda server kanalni "o'qildi" deb belgilaydi — shundan keyin onRead() chaqiriladi (belgilar yangilansin).
export function OfficialChannel({ onBack, onRead }: { onBack: () => void; onRead: () => void }) {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";
  const [identity, setIdentity] = useState<ChannelIdentity | null>(null);
  const [view, setView] = useState<View>("feed");
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<EditingPost | null>(null);
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const viewedRef = useRef<Set<string>>(new Set());

  const markViewed = useCallback((list: AnnouncementItem[]) => {
    const fresh = list.map((x) => x.id).filter((id) => !viewedRef.current.has(id));
    if (fresh.length === 0) return;
    fresh.forEach((id) => viewedRef.current.add(id));
    fetch("/api/announcements/view", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: fresh }) })
      .then((r) => (r.ok ? r.json() : null)).then((counts) => {
        if (!counts) return;
        setItems((p) => p.map((x) => (x.id in counts ? { ...x, views_count: counts[x.id] } : x)));
      }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/announcements");
      if (!res.ok) { setFailed(true); return; }
      const list: AnnouncementItem[] = await res.json();
      setItems(Array.isArray(list) ? list : []); setHasMore(Array.isArray(list) && list.length >= ANNOUNCE_PAGE_SIZE);
      onRead(); markViewed(Array.isArray(list) ? list : []);
    } catch { setFailed(true); } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/channel").then((r) => (r.ok ? r.json() : null)).then((d) => { if (alive && d) setIdentity(d); }).catch(() => {});
    void load();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (!loadingMore) endRef.current?.scrollIntoView?.({ behavior: "auto" }); }, [items.length === 0, loading]);  // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(async () => {
    if (loadingMore || items.length === 0) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/announcements?before=${encodeURIComponent(items[0].created_at)}`);
      if (!res.ok) return;
      const older: AnnouncementItem[] = await res.json();
      setItems((p) => { const seen = new Set(p.map((x) => x.id)); return [...older.filter((x) => !seen.has(x.id)), ...p]; });
      setHasMore(older.length >= ANNOUNCE_PAGE_SIZE); markViewed(older);
    } finally { setLoadingMore(false); }
  }, [items, loadingMore, markViewed]);

  const name = identity?.name || "TrainerTop";

  const startEdit = (a: AnnouncementItem) => {
    setEditingPost({ id: a.id, title: a.title, body: a.body, image_url: a.image_url, video_url: a.video_url, video_thumbnail_url: a.video_thumbnail_url, video_duration: a.video_duration });
  };
  const doDelete = async (a: AnnouncementItem) => {
    if (!window.confirm("Post kanaldan hamma uchun o'chiriladi. Davom etasizmi?")) return;
    const res = await fetch(`/api/admin/announcements/${a.id}`, { method: "DELETE" });
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.message || "O'chirilmadi"); return; }
    toast.success("Post o'chirildi"); void load();
  };

  if (view === "comments" && commentsFor) {
    return (
      <CommentsPanel announcementId={commentsFor} isAdmin={isAdmin} currentUserId={user?.id || ""}
        onBack={() => { setView("feed"); setCommentsFor(null); }}
        onCountChange={(n) => setItems((p) => p.map((x) => (x.id === commentsFor ? { ...x, comments_count: n } : x)))} />
    );
  }

  if (view === "info") {
    return <ChannelInfo identity={identity} isAdmin={isAdmin} onBack={() => setView("feed")} onSaved={(next) => setIdentity(next)} />;
  }

  return (
    <>
      <div className="flex items-center gap-3 p-4 border-b border-white/[0.06]">
        <button onClick={onBack} aria-label="Orqaga" className="sm:hidden text-white/40 hover:text-white"><ArrowLeft className="h-5 w-5" /></button>
        <button onClick={() => setView("info")} aria-label="Kanal haqida ma'lumot" className="flex items-center gap-3 min-w-0 flex-1 text-left">
          <div className="w-9 h-9 rounded-full bg-lime flex items-center justify-center overflow-hidden shrink-0">
            {identity?.avatar_url ? <img src={identity.avatar_url} alt="" className="w-full h-full object-cover" /> : identity?.name ? <span className="text-xs font-bold text-black">{getInitials(name)}</span> : <Megaphone className="h-4 w-4 text-black" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{name}</p>
            <p className="text-[10px] text-white/30 truncate">{typeof identity?.subscribers === "number" ? `${identity.subscribers.toLocaleString("uz-UZ")} obunachi` : "Rasmiy kanal"}{!isAdmin && " · faqat o'qish"}</p>
          </div>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3" data-testid="official-list">
        {hasMore && <div className="text-center"><button onClick={loadMore} disabled={loadingMore} className="text-xs text-lime/80 disabled:opacity-40">{loadingMore ? "Yuklanmoqda..." : "Oldingi e'lonlar"}</button></div>}
        {loading ? <div className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin text-lime mx-auto" /></div>
          : failed ? <p className="text-xs text-white/30 text-center py-10">E'lonlarni yuklab bo'lmadi. Keyinroq urinib ko'ring</p>
          : items.length === 0 ? <p className="text-xs text-white/30 text-center py-10">Hali e'lon yo'q</p>
          : items.map((a) => (
            <div key={a.id} className="flex justify-start">
              <AnnouncementCard item={a} onOpenImage={setViewer} canManage={isAdmin}
                onEdit={() => startEdit(a)} onDelete={() => doDelete(a)}
                onComments={() => { setCommentsFor(a.id); setView("comments"); }} />
            </div>
          ))}
        <div ref={endRef} />
      </div>
      {isAdmin ? (
        <ChannelComposer onSent={() => void load()} editing={editingPost} onCancelEdit={() => setEditingPost(null)} />
      ) : (
        <div className="p-3 border-t border-white/[0.06] text-center text-[11px] text-white/30">
          Bu kanalga javob yozib bo'lmaydi. Savolingiz bormi? <Link href="/support" className="text-lime hover:underline">Yordamga yozing</Link>
        </div>
      )}
      {viewer && <ImageViewer url={viewer} onClose={() => setViewer(null)} />}
    </>
  );
}

// Kanal haqida (bio) — admin bo'lsa "Tahrirlash" bilan nom/rasm/bio/username'ni shu yerdan o'zgartirish mumkin.
function ChannelInfo({ identity, isAdmin, onBack, onSaved }: { identity: ChannelIdentity | null; isAdmin: boolean; onBack: () => void; onSaved: (next: ChannelIdentity) => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [name, setName] = useState(identity?.name || "TrainerTop");
  const [avatar, setAvatar] = useState<string | null>(identity?.avatar_url || null);
  const [bio, setBio] = useState(identity?.bio || "");
  const [username, setUsername] = useState(identity?.username || "");
  const fileRef = useRef<HTMLInputElement>(null);
  const displayName = identity?.name || "TrainerTop";

  const pickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    setUploadingAvatar(true);
    try { setAvatar(await uploadImage(f, "channel")); } catch (err: any) { toast.error(err?.message || "Rasmni yuklab bo'lmadi"); } finally { setUploadingAvatar(false); }
  };

  const usernameOk = !username.trim() || /^[A-Za-z0-9_]{3,30}$/.test(username.trim());
  const nameOk = name.trim().length > 0 && name.trim().length <= CHANNEL_NAME_MAX;

  const save = async () => {
    if (!nameOk || !usernameOk || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/channel", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), avatar_url: avatar, bio: bio.trim() || null, username: username.trim() || null }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.message || "Saqlanmadi"); return; }
      toast.success("Kanal sozlamalari saqlandi"); onSaved({ name: d.name, avatar_url: d.avatar_url, bio: d.bio, username: d.username }); setEditing(false);
    } catch { toast.error("Saqlanmadi"); } finally { setSaving(false); }
  };

  return (
    <>
      <div className="flex items-center gap-3 p-4 border-b border-white/[0.06]">
        <button onClick={onBack} aria-label="Orqaga" className="text-white/40 hover:text-white"><ArrowLeft className="h-5 w-5" /></button>
        <p className="text-sm font-semibold flex-1">{editing ? "Kanalni tahrirlash" : "Kanal haqida"}</p>
        {isAdmin && !editing && <button onClick={() => setEditing(true)} aria-label="Kanalni tahrirlash" className="text-white/40 hover:text-lime"><Pencil className="h-4 w-4" /></button>}
      </div>
      {editing ? (
        <div className="flex-1 overflow-y-auto p-6 space-y-4" data-testid="channel-edit-form">
          <div className="flex justify-center">
            <div className="relative w-20 h-20 rounded-full bg-dark-card flex items-center justify-center overflow-hidden shrink-0">
              {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : <Megaphone className="h-6 w-6 text-white/20" />}
              <button onClick={() => fileRef.current?.click()} disabled={uploadingAvatar} aria-label="Kanal rasmini o'zgartirish" className="absolute inset-0 bg-dark/60 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">{uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}</button>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickAvatar} data-testid="channel-edit-avatar-input" />
          <div><label className="block text-xs text-white/40 mb-1.5">Nomi</label><input value={name} onChange={(e) => setName(e.target.value)} maxLength={CHANNEL_NAME_MAX} aria-label="Kanal nomi" className={cn("input-field text-sm", !nameOk && "!border-red-500/60")} /></div>
          <div><label className="block text-xs text-white/40 mb-1.5">Username</label><div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-sm">@</span><input value={username} onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))} maxLength={30} aria-label="Kanal username" className={cn("input-field !pl-8 text-sm", !usernameOk && "!border-red-500/60")} /></div>{!usernameOk && <p className="text-[11px] text-red-400 mt-1">3-30 belgi, faqat lotin harf/raqam/pastki chiziq (_)</p>}</div>
          <div><label className="block text-xs text-white/40 mb-1.5">Bio</label><textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={CHANNEL_BIO_MAX} rows={3} aria-label="Kanal bio" className="input-field text-sm resize-none" /></div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="btn-outline flex-1 !py-2.5 text-sm">Bekor qilish</button>
            <button onClick={save} disabled={!nameOk || !usernameOk || saving || uploadingAvatar} className="btn-lime flex-1 !py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-40">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Saqlash
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center text-center" data-testid="channel-info">
          <div className="w-24 h-24 rounded-full bg-lime flex items-center justify-center overflow-hidden shrink-0 mb-4">
            {identity?.avatar_url ? <img src={identity.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-3xl font-bold text-black">{getInitials(displayName)}</span>}
          </div>
          <p className="text-lg font-bold">{displayName}</p>
          {identity?.username && <p className="text-sm text-white/40 mt-0.5">@{identity.username}</p>}
          {identity?.bio && <p className="text-sm text-white/60 mt-4 max-w-sm whitespace-pre-line">{identity.bio}</p>}
          <p className="text-[11px] text-white/25 mt-6">{typeof identity?.subscribers === "number" ? `${identity.subscribers.toLocaleString("uz-UZ")} obunachi · ` : ""}Rasmiy kanal</p>
        </div>
      )}
    </>
  );
}
