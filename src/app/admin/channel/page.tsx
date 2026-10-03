"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Megaphone, ImagePlus, Video, X, Trash2, Send, Save, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadImage, uploadPoster, uploadVideoDirect, validateVideoFile, getVideoMeta, captureVideoPoster, formatDuration } from "@/lib/upload";
import { VIDEO_POST_MAX_BYTES, VIDEO_POST_MAX_SECONDS } from "@/lib/constants";
import { AnnouncementCard } from "@/components/chat/AnnouncementCard";
import { ANNOUNCE_TITLE_MAX, ANNOUNCE_BODY_MAX, ANNOUNCE_LABEL_MAX, CHANNEL_NAME_MAX, CHANNEL_BIO_MAX, safeLink } from "@/lib/announcements";

const newToken = () => (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
  ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 3) | 8).toString(16); }));

// Admin › Rasmiy kanal: Telegram kanali kabi — identifikator (nom/rasm/bio/@username) va erkin post
// (matn + rasm YOKI video). Har doim HAMMAGA yuboriladi — bu shaxsiy bildirishnoma emas (u E'lonlar
// bo'limida). Kanalni faqat siz boshqarasiz: qachon nima post tashlashni o'zingiz hal qilasiz.
export default function AdminChannelPage() {
  return (
    <div>
      <h1 className="text-lg font-bold mb-1 flex items-center gap-2"><Megaphone className="h-5 w-5 text-lime" />Rasmiy kanal</h1>
      <p className="text-xs text-white/40 mb-5">Foydalanuvchilarning chatida Telegram kanali kabi ko'rinadi — nomga bosilsa profil/bio, umumiy chatga bosilsa postlar oqimi ochiladi.</p>
      <ChannelSettingsCard />
      <Composer />
    </div>
  );
}

// ============================================================ Kanal identifikatori
function ChannelSettingsCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [name, setName] = useState(""); const [avatar, setAvatar] = useState<string | null>(null);
  const [bio, setBio] = useState(""); const [username, setUsername] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/channel"); const d = await res.json().catch(() => ({}));
        if (!alive) return;
        if (res.ok) { setName(d.name || "TrainerTop"); setAvatar(d.avatar_url || null); setBio(d.bio || ""); setUsername(d.username || ""); }
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

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
      toast.success("Kanal sozlamalari saqlandi");
    } catch { toast.error("Saqlanmadi"); } finally { setSaving(false); }
  };

  if (loading) return <div className="card p-4 mb-5"><Loader2 className="h-4 w-4 animate-spin text-lime mx-auto" /></div>;
  return (
    <div className="card p-4 mb-5 space-y-3" data-testid="channel-settings">
      <h2 className="text-sm font-semibold">Kanal identifikatori</h2>
      <div className="flex items-center gap-3">
        <div className="relative w-14 h-14 rounded-full bg-dark-card flex items-center justify-center overflow-hidden shrink-0">
          {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : <Megaphone className="h-5 w-5 text-white/20" />}
          <button onClick={() => fileRef.current?.click()} disabled={uploadingAvatar} aria-label="Kanal rasmini o'zgartirish" className="absolute inset-0 bg-dark/60 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">{uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}</button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickAvatar} data-testid="channel-avatar-input" />
        <div className="flex-1 grid sm:grid-cols-2 gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={CHANNEL_NAME_MAX} placeholder="Kanal nomi" aria-label="Kanal nomi" className={cn("input-field text-sm", !nameOk && "!border-red-500/60")} />
          <div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-sm">@</span><input value={username} onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))} maxLength={30} placeholder="username" aria-label="Kanal username" className={cn("input-field !pl-8 text-sm", !usernameOk && "!border-red-500/60")} /></div>
        </div>
      </div>
      <div>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={CHANNEL_BIO_MAX} rows={2} placeholder="Bio (ixtiyoriy)" aria-label="Kanal bio" className="input-field text-sm resize-none" />
        <p className="text-[10px] text-white/30 text-right mt-0.5">{bio.length}/{CHANNEL_BIO_MAX}</p>
      </div>
      {!usernameOk && <p className="text-[11px] text-red-400">Username 3-30 belgi, faqat lotin harf/raqam/pastki chiziq (_)</p>}
      <button onClick={save} disabled={!nameOk || !usernameOk || saving || uploadingAvatar} className="btn-outline !py-2 !px-4 text-xs flex items-center gap-1.5 disabled:opacity-40">
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Saqlash
      </button>
    </div>
  );
}

interface VideoState { file: File; url: string; meta: { duration: number }; poster: Blob | null; posterUrl?: string }

// ============================================================ Composer (har doim hammaga) + tarix
function Composer() {
  const [title, setTitle] = useState(""); const [body, setBody] = useState("");
  const [image, setImage] = useState<string | null>(null); const [uploading, setUploading] = useState(false);
  const [video, setVideo] = useState<VideoState | null>(null); const [preparing, setPreparing] = useState(false); const [progress, setProgress] = useState(0);
  const [link, setLink] = useState(""); const [label, setLabel] = useState("");
  const [sending, setSending] = useState(false);
  const token = useRef(newToken());
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const posterPromiseRef = useRef<Promise<Blob | null> | null>(null);
  const [rows, setRows] = useState<any[]>([]); const [total, setTotal] = useState(0); const [audience, setAudience] = useState(0); const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/announcements"); const d = await res.json().catch(() => ({}));
      if (res.ok) { setRows((d.rows || []).filter((r: any) => r.kind === "all")); setTotal(d.total || 0); setAudience(d.audience || 0); } else toast.error(d.message || "Tarixni yuklab bo'lmadi");
    } catch { toast.error("Tarixni yuklab bo'lmadi"); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const pickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    if (video) { toast.error("Rasm va video birga bo'lmaydi"); return; }
    setUploading(true);
    try { setImage(await uploadImage(f, "channel")); } catch (err: any) { toast.error(err?.message || "Rasmni yuklab bo'lmadi"); } finally { setUploading(false); }
  };

  const pickVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    if (image) { toast.error("Rasm va video birga bo'lmaydi"); return; }
    const err = validateVideoFile(f, VIDEO_POST_MAX_BYTES);
    if (err) { toast.error(err); return; }
    setPreparing(true);
    try {
      const meta = await getVideoMeta(f);
      if (meta.duration > VIDEO_POST_MAX_SECONDS + 0.5) { toast.error(`Video ${formatDuration(meta.duration)} — maksimum ${formatDuration(VIDEO_POST_MAX_SECONDS)}`); return; }
      setVideo({ file: f, url: URL.createObjectURL(f), meta, poster: null });
      const pending = captureVideoPoster(f); posterPromiseRef.current = pending;
      pending.then((blob) => { if (blob) setVideo((v) => (v && v.file === f ? { ...v, poster: blob, posterUrl: URL.createObjectURL(blob) } : v)); });
    } catch (err: any) { toast.error(err?.message || "Videoni o'qib bo'lmadi"); } finally { setPreparing(false); }
  };

  const removeVideo = () => { if (video) { URL.revokeObjectURL(video.url); if (video.posterUrl) URL.revokeObjectURL(video.posterUrl); } posterPromiseRef.current = null; setVideo(null); };

  const linkOk = !link.trim() || !!safeLink(link);
  const hasContent = !!body.trim() || !!image || !!video;
  const valid = title.trim().length <= ANNOUNCE_TITLE_MAX && hasContent && body.trim().length <= ANNOUNCE_BODY_MAX && linkOk && label.trim().length <= ANNOUNCE_LABEL_MAX;

  const send = async () => {
    if (!valid || sending || uploading || preparing) return;
    if (!window.confirm(`Kanalga (taxminan ${audience} kishi ko'radi) yuborilsinmi? Qaytarib olish mumkin, lekin ko'rganlar ko'rib bo'lgan bo'ladi.`)) return;
    setSending(true);
    try {
      const payload: Record<string, any> = {
        kind: "all", title: title.trim() || undefined, body: body.trim() || undefined,
        link_url: link.trim() || undefined, link_label: label.trim() || undefined, client_token: token.current,
      };
      if (video) {
        setProgress(0);
        const videoUrl = await uploadVideoDirect(video.file, { folder: "channel", onProgress: setProgress });
        const posterBlob = video.poster ?? (await posterPromiseRef.current);
        const thumb = posterBlob ? await uploadPoster(posterBlob, "channel") : null;
        payload.video_url = videoUrl; payload.video_thumbnail_url = thumb; payload.video_duration = Math.round(video.meta.duration);
      } else if (image) {
        payload.image_url = image;
      }
      const res = await fetch("/api/admin/announcements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.message || "Yuborilmadi"); return; }
      toast.success(d.duplicate ? "Bu post allaqachon yuborilgan" : "Kanalga yuborildi");
      setTitle(""); setBody(""); setImage(null); removeVideo(); setLink(""); setLabel(""); token.current = newToken();
      void loadHistory();
    } catch { toast.error("Yuborilmadi"); } finally { setSending(false); setProgress(0); }
  };

  const remove = async (r: any) => {
    if (!window.confirm(`«${r.title || "Bu post"}» kanaldan hamma uchun o'chiriladi. Davom etasizmi?`)) return;
    const res = await fetch(`/api/admin/announcements/${r.id}`, { method: "DELETE" });
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.message || "O'chirilmadi"); return; }
    toast.success("Post o'chirildi"); void loadHistory();
  };

  return (
    <div>
      <div className="grid lg:grid-cols-2 gap-5 mb-8">
        <div className="card p-4 space-y-4">
          <div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={ANNOUNCE_TITLE_MAX} placeholder="Sarlavha (ixtiyoriy)" className="input-field text-sm" aria-label="Sarlavha" />
            <p className="text-[10px] text-white/30 text-right mt-0.5">{title.length}/{ANNOUNCE_TITLE_MAX}</p>
          </div>
          <div>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={ANNOUNCE_BODY_MAX} rows={6} placeholder="Matn... (rasm yoki video bo'lsa ixtiyoriy)" className="input-field text-sm resize-none" aria-label="Matn" />
            <p className="text-[10px] text-white/30 text-right mt-0.5">{body.length}/{ANNOUNCE_BODY_MAX}</p>
          </div>

          <div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickImage} data-testid="channel-post-image-input" />
            <input ref={videoRef} type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden" onChange={pickVideo} data-testid="channel-post-video-input" />
            {image ? (
              <div className="relative inline-block"><img src={image} alt="" className="h-24 rounded-lg" /><button onClick={() => setImage(null)} aria-label="Rasmni olib tashlash" className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center"><X className="h-3 w-3" /></button></div>
            ) : video ? (
              <div className="relative inline-block"><video src={video.url} className="h-24 rounded-lg" muted /><button onClick={removeVideo} aria-label="Videoni olib tashlash" className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center"><X className="h-3 w-3" /></button></div>
            ) : (
              <div className="flex gap-4">
                <button onClick={() => fileRef.current?.click()} disabled={uploading || preparing} className="text-xs text-lime flex items-center gap-1.5 disabled:opacity-40">{uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}Rasm</button>
                <button onClick={() => videoRef.current?.click()} disabled={uploading || preparing} className="text-xs text-lime flex items-center gap-1.5 disabled:opacity-40">{preparing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Video className="h-3.5 w-3.5" />}Video</button>
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div><input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Havola: /lessons yoki https://..." className={cn("input-field text-sm", !linkOk && "!border-red-500/60")} aria-label="Havola" />
              {!linkOk && <p className="text-[10px] text-red-400 mt-0.5">Faqat sayt ichidagi yo'l (/...) yoki https://</p>}</div>
            <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={ANNOUNCE_LABEL_MAX} placeholder="Tugma yozuvi (masalan: Ko'rish)" className="input-field text-sm" aria-label="Tugma yozuvi" />
          </div>

          <button onClick={send} disabled={!valid || sending || uploading || preparing} className="btn-lime w-full !py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-40">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Kanalga yuborish (~{audience})
          </button>
          {sending && video && <p className="text-[10px] text-white/30 text-center">Video yuklanmoqda: {Math.round(progress * 100)}%</p>}
        </div>

        <div>
          <p className="text-[11px] text-white/30 mb-2">Foydalanuvchida shunday ko'rinadi:</p>
          <div className="flex justify-start">
            <AnnouncementCard preview item={{
              kind: "all", title: title.trim() || null, body: body.trim() || (image || video ? null : "Post matni shu yerda ko'rinadi..."),
              image_url: image, video_url: video?.url || null, video_thumbnail_url: video?.posterUrl || null, video_duration: video ? Math.round(video.meta.duration) : null,
              link_url: link.trim() || null, link_label: label.trim() || null, created_at: new Date().toISOString(),
            }} />
          </div>
        </div>
      </div>

      <h2 className="text-sm font-semibold mb-3">Kanalga yuborilgan postlar {total > 0 && <span className="text-white/30 font-normal">({rows.length})</span>}</h2>
      {loading ? <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin text-lime mx-auto" /></div> : rows.length === 0 ? <p className="text-xs text-white/30 py-6">Hali post yuborilmagan</p> : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className={cn("card p-4", r.deleted_at && "opacity-50")} data-testid="channel-post-row">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                {r.lesson_id
                  ? <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-500/15 text-amber-400">Boost</span>
                  : <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-lime/15 text-lime">Kanal posti</span>}
                {r.deleted_at && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">O'chirilgan</span>}
                <span className="text-[10px] text-white/30 ml-auto">{new Date(r.created_at).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              {r.title && <p className={cn("text-sm font-semibold", r.deleted_at && "line-through")}>{r.title}</p>}
              <p className="text-xs text-white/50 line-clamp-2 whitespace-pre-line">{r.body || (r.image_url ? "[Rasm]" : r.video_url ? "[Video]" : "")}</p>
              <div className="flex items-center gap-3 mt-2 text-[11px] text-white/40">
                <span>{r.recipients} kishiga · {r.reads} tasi kanalni ochgan</span>
                {r.lesson_id && <span className="text-amber-400/80" data-testid="boost-sales">Boostdan keyin 7 kunda: {r.sales_7d ?? 0} ta sotuv</span>}
                {!r.deleted_at && <button onClick={() => remove(r)} aria-label={`«${r.title || "Bu post"}» ni o'chirish`} className="ml-auto text-red-400/70 hover:text-red-400 flex items-center gap-1"><Trash2 className="h-3 w-3" />O'chirish</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
