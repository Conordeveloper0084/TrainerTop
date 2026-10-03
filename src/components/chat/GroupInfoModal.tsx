"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X, Camera, Pencil, Check, Loader2, ShieldAlert, UserPlus, Lock, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { getInitials } from "@/lib/utils";
import { GROUP_BIO_MAX, GROUP_NAME_MAX } from "@/lib/constants";
import { uploadImage } from "@/lib/upload";
import { formatUntil, reasonLabel } from "@/lib/chat-moderation";
import { ModerationDialog, type ModerationSubmit } from "./ModerationDialog";

export interface GroupDetail {
  id: string; lesson_id: string; name: string; bio: string | null; avatar_url: string | null;
  access: "owner" | "active" | "expired" | "removed"; role: "owner" | "member"; member_count: number; seen_intro: boolean;
  muted_until?: string | null;
  mod?: { reason?: string | null; note?: string | null; by_admin?: boolean; at?: string | null } | null;
  lesson?: { id: string; title: string; price_monthly: number | null; pricing_model: string | null } | null;
  owner?: { id: string; full_name: string; avatar_url: string | null } | null;
}
interface Member {
  user_id: string; role: string; status: string; state: string; full_name: string; avatar_url: string | null;
  muted_until?: string | null; mod_reason?: string | null; mod_note?: string | null; mod_by_admin?: boolean; mod_at?: string | null;
}

// "Guruh haqida": rasm, nom, tavsif, darslik, a'zolar. Guruh admini (trener) tahrirlay oladi va a'zolarga chora ko'radi
// (yozishni cheklash yoki chiqarish — sabab bilan). Chiqarilganlar sabab bilan alohida ro'yxatda, qaytarish mumkin.
export function GroupInfoModal({ group, onClose, onUpdated }: { group: GroupDetail; onClose: () => void; onUpdated: (g: Partial<GroupDetail>) => void }) {
  const isOwner = group.role === "owner";
  const [name, setName] = useState(group.name);
  const [bio, setBio] = useState(group.bio || "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dialogFor, setDialogFor] = useState<Member | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadMembers = async () => {
    try {
      const res = await fetch(`/api/chat/groups/${group.id}/members`);
      setMembers(res.ok ? await res.json() : []);
    } catch { setMembers([]); }
  };
  useEffect(() => { void loadMembers(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [group.id]);

  const patch = async (body: Record<string, any>) => {
    const res = await fetch(`/api/chat/groups/${group.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.message || "Xatolik");
    return d;
  };

  const save = async () => {
    if (!name.trim()) { toast.error("Guruh nomi bo'sh bo'lmasin"); return; }
    setSaving(true);
    try {
      const d = await patch({ name: name.trim(), bio: bio.trim() });
      onUpdated({ name: d.name, bio: d.bio });
      setEditing(false);
      toast.success("Saqlandi");
    } catch (e: any) { toast.error(e.message || "Xatolik"); } finally { setSaving(false); }
  };

  const changeAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    setSaving(true);
    try {
      const url = await uploadImage(file, "avatars");
      const d = await patch({ avatar_url: url });
      onUpdated({ avatar_url: d.avatar_url });
      toast.success("Rasm yangilandi");
    } catch (err: any) { toast.error(err?.message || "Rasmni yuklab bo'lmadi"); } finally { setSaving(false); }
  };

  // A'zoga chora (cheklash / chiqarish / cheklovni olib tashlash / qaytarish). Muvaffaqiyatli bo'lsa true.
  const moderate = async (m: Member, body: Record<string, any>): Promise<boolean> => {
    setBusyId(m.user_id);
    try {
      const res = await fetch(`/api/chat/groups/${group.id}/members/${m.user_id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.message || "Xatolik"); return false; }
      await loadMembers();
      return true;
    } catch { toast.error("Xatolik"); return false; } finally { setBusyId(null); }
  };

  const submitDialog = async (body: ModerationSubmit) => {
    if (!dialogFor) return;
    if (await moderate(dialogFor, body)) {
      toast.success(body.action === "remove" ? "A'zo guruhdan chiqarildi" : body.action === "mute" ? "A'zoning yozishi cheklandi" : "Cheklov olib tashlandi");
      setDialogFor(null);
    }
  };

  const active = (members || []).filter((m) => m.status === "active" || m.role === "owner");
  const removed = (members || []).filter((m) => m.status === "removed");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose} role="dialog" aria-label="Guruh haqida">
      <div className="bg-dark-surface border border-white/[0.08] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <h2 className="font-semibold text-sm">Guruh haqida</h2>
          <button onClick={onClose} aria-label="Yopish" className="text-white/40 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5">
          <div className="flex flex-col items-center text-center mb-5">
            <div className="relative mb-3">
              <div className="w-20 h-20 rounded-full bg-dark-card flex items-center justify-center overflow-hidden">
                {group.avatar_url ? <img src={group.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xl font-bold text-white/30">{getInitials(group.name)}</span>}
              </div>
              {isOwner && (
                <>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={changeAvatar} data-testid="group-avatar-input" />
                  <button onClick={() => fileRef.current?.click()} disabled={saving} aria-label="Guruh rasmini o'zgartirish"
                    className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-lime text-black flex items-center justify-center disabled:opacity-40"><Camera className="h-4 w-4" /></button>
                </>
              )}
            </div>

            {editing ? (
              <div className="w-full space-y-2 text-left">
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={GROUP_NAME_MAX} className="input-field text-sm" aria-label="Guruh nomi" />
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={GROUP_BIO_MAX} rows={4} placeholder="Guruh haqida (qoidalar, vazifalar, tushuntirish)..." className="input-field text-sm resize-none" aria-label="Guruh haqida matn" />
                <p className="text-[10px] text-white/30 text-right">{bio.length}/{GROUP_BIO_MAX}</p>
                <div className="flex gap-2">
                  <button onClick={() => { setEditing(false); setName(group.name); setBio(group.bio || ""); }} className="btn-outline flex-1 !py-2 text-xs">Bekor qilish</button>
                  <button onClick={save} disabled={saving} className="btn-lime flex-1 !py-2 text-xs flex items-center justify-center gap-1.5 disabled:opacity-40">{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}Saqlash</button>
                </div>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-bold">{group.name}</h3>
                <p className="text-xs text-white/40 mt-0.5">{group.member_count} ta a'zo</p>
                {group.bio ? <p className="text-sm text-white/60 mt-3 whitespace-pre-line text-left w-full bg-dark-card rounded-xl p-3">{group.bio}</p>
                  : isOwner ? <p className="text-xs text-white/30 mt-3">Guruh haqida hali yozilmagan</p> : null}
                {isOwner && <button onClick={() => setEditing(true)} className="mt-3 text-xs text-lime flex items-center gap-1.5"><Pencil className="h-3 w-3" />Nom va tavsifni tahrirlash</button>}
              </>
            )}
          </div>

          <div className="bg-dark-card rounded-xl p-3 mb-5 text-xs space-y-1.5">
            <p className="text-white/40">Darslik: {group.lesson ? <Link href={`/lessons/${group.lesson.id}`} className="text-lime hover:underline">{group.lesson.title}</Link> : "—"}</p>
            <p className="text-white/40">Trener: <span className="text-white/70">{group.owner?.full_name || "—"}</span></p>
            <p className="text-white/30 flex items-center gap-1.5"><Lock className="h-3 w-3" />Yopiq guruh: faqat darslikni sotib olganlar qo'shiladi</p>
          </div>

          <p className="text-[11px] text-white/30 uppercase tracking-wider mb-2">A'zolar</p>
          {members === null ? <div className="py-4 text-center"><Loader2 className="h-4 w-4 animate-spin text-lime mx-auto" /></div> : (
            <ul className="space-y-1">
              {active.map((m) => (
                <li key={m.user_id} className="flex items-center gap-3 py-1.5" data-testid="member-row">
                  <div className="w-8 h-8 rounded-full bg-dark-card flex items-center justify-center overflow-hidden shrink-0">
                    {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-[10px] font-bold text-white/30">{getInitials(m.full_name)}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{m.full_name}</p>
                    {m.role === "owner" ? <p className="text-[10px] text-lime">Trener · admin</p>
                      : m.state === "muted" ? <p className="text-[10px] text-orange-400 flex items-center gap-1"><VolumeX className="h-2.5 w-2.5" />Cheklangan: {formatUntil(m.muted_until)}{m.mod_by_admin ? " (admin)" : ""}</p>
                      : m.state === "expired" ? <p className="text-[10px] text-yellow-500">Obunasi tugagan</p> : null}
                  </div>
                  {isOwner && m.role !== "owner" && (
                    <button onClick={() => setDialogFor(m)} disabled={busyId === m.user_id} aria-label={`${m.full_name} ga chora ko'rish`} title="Chora ko'rish (cheklash yoki chiqarish)"
                      className="p-1.5 text-white/30 hover:text-red-400 disabled:opacity-40"><ShieldAlert className="h-4 w-4" /></button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {isOwner && removed.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] text-white/30 uppercase tracking-wider mb-2">Chiqarilganlar</p>
              <ul className="space-y-2">
                {removed.map((m) => (
                  <li key={m.user_id} className="bg-dark-card rounded-lg p-2.5" data-testid="removed-row">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-sm truncate">{m.full_name}</span>
                      <button onClick={async () => { if (await moderate(m, { action: "restore" })) toast.success("A'zo guruhga qaytarildi"); }} disabled={busyId === m.user_id || !!m.mod_by_admin}
                        aria-label={`${m.full_name} ni qaytarish`} title={m.mod_by_admin ? "Administratsiya chiqargan — faqat admin qaytara oladi" : "Guruhga qaytarish"}
                        className="p-1.5 text-white/40 hover:text-lime disabled:opacity-30 disabled:cursor-not-allowed"><UserPlus className="h-4 w-4" /></button>
                    </div>
                    <p className="text-[11px] text-white/50 mt-1">{reasonLabel(m.mod_reason)}{m.mod_note ? ` — ${m.mod_note}` : ""}</p>
                    <p className="text-[10px] text-white/30 mt-0.5">{m.mod_by_admin ? "Administratsiya chiqargan (faqat admin qaytaradi)" : "Siz chiqargansiz"}{m.mod_at ? ` · ${new Date(m.mod_at).toLocaleDateString("uz-UZ")}` : ""}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {dialogFor && (
        <div onClick={(e) => e.stopPropagation()}>
          <ModerationDialog memberName={dialogFor.full_name} isMuted={dialogFor.state === "muted"} onSubmit={submitDialog} onClose={() => setDialogFor(null)} />
        </div>
      )}
    </div>
  );
}
