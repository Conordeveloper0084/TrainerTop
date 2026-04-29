"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, Plus, Trash2, ChevronUp, ChevronDown, Upload, Video, Image, Save, Loader2, Eye, Play, Dumbbell, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { cn, formatPrice, getSpecializationLabel } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/auth-store";
import { SPECIALIZATIONS } from "@/lib/constants";

interface VideoItem { id: string; title: string; description: string; url: string; uploading: boolean; }
interface Section { id: string; title: string; content: string; videos: VideoItem[]; }

export default function CreateLessonWrapper() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-6 w-6 text-lime animate-spin" /></div>}>
      <CreateLessonPage />
    </Suspense>
  );
}

function CreateLessonPage() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const isEdit = !!editId;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pricingModel, setPricingModel] = useState<"lifetime" | "monthly" | "both">("lifetime");
  const [priceLifetime, setPriceLifetime] = useState("");
  const [priceMonthly, setPriceMonthly] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState("beginner");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [existingCover, setExistingCover] = useState("");
  const [sections, setSections] = useState<Section[]>([{ id: "s1", title: "", content: "", videos: [] }]);
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [lessonStatus, setLessonStatus] = useState("draft");
  const user = useAuthStore((s) => s.user);

  // Edit mode — mavjud darslik ma'lumotlarini yuklash
  useEffect(() => {
    if (!editId) return;
    setLoadingEdit(true);
    (async () => {
      try {
        const res = await fetch(`/api/lessons/${editId}`);
        if (!res.ok) { toast.error("Darslik topilmadi"); return; }
        const lesson = await res.json();

        // Trener ekanligini tekshirish
        if (lesson.trainer_id !== user?.id) { toast.error("Bu sizning darsligingiz emas"); return; }

        setTitle(lesson.title || "");
        setDescription(lesson.description || "");
        setPricingModel(lesson.pricing_model || "lifetime");
        setPriceLifetime((lesson.price_lifetime || lesson.price || "").toString());
        setPriceMonthly((lesson.price_monthly || "").toString());
        setCategories(lesson.category ? [lesson.category] : []);
        setDifficulty(lesson.difficulty || "beginner");
        setLessonStatus(lesson.status || "draft");

        if (lesson.cover_image_url) {
          setExistingCover(lesson.cover_image_url);
          setCoverPreview(lesson.cover_image_url);
        }

        // Sections/modullar yuklash
        const loadedSections = lesson.content?.sections || [];
        if (loadedSections.length > 0) {
          setSections(loadedSections.map((s: any, i: number) => ({
            id: `s-${i}-${Date.now()}`,
            title: s.title || "",
            content: s.content || "",
            videos: (s.videos || []).map((v: any, vi: number) => ({
              id: `v-${i}-${vi}-${Date.now()}`,
              title: v.title || `Video ${vi + 1}`,
              description: v.description || "",
              url: v.url || "",
              uploading: false,
            })),
          })));
        }
      } catch { toast.error("Yuklashda xatolik"); } finally { setLoadingEdit(false); }
    })();
  }, [editId, user?.id]);

  const toggleCategory = (cat: string) => {
    setCategories((p) => p.includes(cat) ? p.filter((c) => c !== cat) : p.length >= 2 ? (toast.error("Ko'pi bilan 2 ta kategoriya"), p) : [...p, cat]);
  };

  const addSection = () => setSections([...sections, { id: `s-${Date.now()}`, title: "", content: "", videos: [] }]);
  const removeSection = (id: string) => { if (sections.length <= 1) return; setSections(sections.filter((s) => s.id !== id)); };
  const updateSection = (id: string, field: string, value: any) => setSections(sections.map((s) => s.id === id ? { ...s, [field]: value } : s));
  const moveSection = (i: number, d: number) => { const n = i + d; if (n < 0 || n >= sections.length) return; const a = [...sections]; [a[i], a[n]] = [a[n], a[i]]; setSections(a); };

  const handleCover = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) { setCoverFile(f); setCoverPreview(URL.createObjectURL(f)); } };

  // Video yuklash — har bo'limda alohida
  const handleVideoUpload = async (sectionId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !file.type.startsWith("video/")) { toast.error("Faqat video fayl"); return; }
    e.target.value = "";

    const videoId = `v-${Date.now()}`;
    const videoItem: VideoItem = { id: videoId, title: file.name.replace(/\.[^.]+$/, ""), description: "", url: "", uploading: true };

    // State ga qo'shish
    setSections((prev) => prev.map((s) => s.id === sectionId ? { ...s, videos: [...s.videos, videoItem] } : s));

    // Upload
    const formData = new FormData();
    formData.append("file", file);
    formData.append("bucket", "lessons");
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (res.ok) {
      const { url } = await res.json();
      setSections((prev) => prev.map((s) => s.id === sectionId ? { ...s, videos: s.videos.map((v) => v.id === videoId ? { ...v, url, uploading: false } : v) } : s));
      toast.success("Video yuklandi!");
    } else {
      setSections((prev) => prev.map((s) => s.id === sectionId ? { ...s, videos: s.videos.filter((v) => v.id !== videoId) } : s));
      toast.error("Video yuklashda xatolik");
    }
  };

  const removeVideo = (sectionId: string, videoId: string) => {
    setSections((prev) => prev.map((s) => s.id === sectionId ? { ...s, videos: s.videos.filter((v) => v.id !== videoId) } : s));
  };

  const updateVideoTitle = (sectionId: string, videoId: string, newTitle: string) => {
    setSections((prev) => prev.map((s) => s.id === sectionId ? { ...s, videos: s.videos.map((v) => v.id === videoId ? { ...v, title: newTitle } : v) } : s));
  };

  const updateVideoDesc = (sectionId: string, videoId: string, desc: string) => {
    setSections((prev) => prev.map((s) => s.id === sectionId ? { ...s, videos: s.videos.map((v) => v.id === videoId ? { ...v, description: desc } : v) } : s));
  };

  const handleSave = async (publish: boolean) => {
    if (!title.trim()) { toast.error("Darslik nomi kerak"); return; }

    // Pricing validation
    const lifetimeNum = parseInt(priceLifetime) || 0;
    const monthlyNum = parseInt(priceMonthly) || 0;
    if (pricingModel === "lifetime" && lifetimeNum <= 0) { toast.error("Bir umrlik narxni kiriting"); return; }
    if (pricingModel === "monthly" && monthlyNum <= 0) { toast.error("Oylik narxni kiriting"); return; }
    if (pricingModel === "both" && (lifetimeNum <= 0 || monthlyNum <= 0)) { toast.error("Ikkala narxni ham kiriting"); return; }

    if (categories.length === 0) { toast.error("Kamida 1 kategoriya tanlang"); return; }
    if (sections.some((s) => !s.title.trim())) { toast.error("Barcha bo'limlarga sarlavha kerak"); return; }
    setSaving(true);
    try {
      // Cover yuklash (faqat yangi fayl bo'lsa)
      let coverUrl = existingCover || "";
      if (coverFile) {
        const formData = new FormData();
        formData.append("file", coverFile);
        formData.append("bucket", "lessons");
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (res.ok) { const { url } = await res.json(); coverUrl = url; }
      }

      const body = {
        title: title.trim(), description: description.trim(),
        pricing_model: pricingModel,
        price_lifetime: parseInt(priceLifetime) || 0,
        price_monthly: parseInt(priceMonthly) || 0,
        price: parseInt(priceLifetime) || parseInt(priceMonthly) || 0,
        category: categories[0],
        difficulty, cover_image_url: coverUrl,
        content: { sections: sections.map((s) => ({
          title: s.title, content: s.content,
          videos: s.videos.filter((v) => v.url).map((v) => ({ title: v.title, description: v.description || "", url: v.url })),
        }))},
        status: publish ? "published" : "draft",
      };

      const url = isEdit ? `/api/lessons/${editId}` : "/api/lessons";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? body : { ...body, cover_url: coverUrl }),
      });
      if (!res.ok) throw new Error("Xatolik");
      toast.success(isEdit ? "Darslik yangilandi!" : (publish ? "Darslik e'lon qilindi!" : "Qoralama saqlandi!"));
      window.location.href = isEdit ? `/lessons/${editId}` : "/lessons";
    } catch (e) { toast.error("Xatolik"); } finally { setSaving(false); }
  };

  if (loadingEdit) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 text-lime animate-spin" /></div>;

  return (
    <div className="container-main py-6 max-w-3xl mx-auto">
      <Link href={isEdit ? `/lessons/${editId}` : "/lessons"} className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white mb-6"><ChevronLeft className="h-4 w-4" />Orqaga</Link>
      <h1 className="text-xl font-bold mb-6">{isEdit ? "Darslikni tahrirlash" : "Yangi darslik yaratish"}</h1>

      {/* Asosiy */}
      <div className="card p-6 mb-4">
        <h2 className="font-semibold text-sm mb-4">Asosiy ma'lumotlar</h2>
        <div className="space-y-4">
          <div><label className="block text-xs text-white/40 mb-2">Darslik nomi *</label><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Masalan: Bodybuilding dasturi" className="input-field" /></div>
          <div><label className="block text-xs text-white/40 mb-2">Tavsif</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="input-field resize-none" placeholder="Darslik haqida batafsil..." /></div>

          <div className="grid grid-cols-1 gap-4">
            {/* Pricing model selector */}
            <div>
              <label className="block text-xs text-white/40 mb-2">Narxlash modeli *</label>
              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={() => setPricingModel("lifetime")}
                  className={cn("p-3 rounded-lg border text-left transition-all",
                    pricingModel === "lifetime" ? "border-lime bg-lime/[0.08]" : "border-white/[0.06] bg-dark-card hover:border-white/20")}>
                  <p className="text-xs font-semibold mb-0.5">Bir umrlik</p>
                  <p className="text-[10px] text-white/40">Bir marta to'lab umrbod</p>
                </button>
                <button type="button" onClick={() => setPricingModel("monthly")}
                  className={cn("p-3 rounded-lg border text-left transition-all",
                    pricingModel === "monthly" ? "border-lime bg-lime/[0.08]" : "border-white/[0.06] bg-dark-card hover:border-white/20")}>
                  <p className="text-xs font-semibold mb-0.5">Faqat oylik</p>
                  <p className="text-[10px] text-white/40">Har oy yangilanadi</p>
                </button>
                <button type="button" onClick={() => setPricingModel("both")}
                  className={cn("p-3 rounded-lg border text-left transition-all relative",
                    pricingModel === "both" ? "border-lime bg-lime/[0.08]" : "border-white/[0.06] bg-dark-card hover:border-white/20")}>
                  <span className="absolute -top-2 right-2 text-[8px] bg-lime text-black px-1.5 py-0.5 rounded-full font-bold">TAVSIYA</span>
                  <p className="text-xs font-semibold mb-0.5">Ikkalasi</p>
                  <p className="text-[10px] text-white/40">User tanlaydi</p>
                </button>
              </div>
            </div>

            {/* Narxlar — pricing modelga qarab */}
            <div className="grid grid-cols-2 gap-4">
              {(pricingModel === "lifetime" || pricingModel === "both") && (
                <div>
                  <label className="block text-xs text-white/40 mb-2">Bir umrlik narx (so'm) *</label>
                  <input type="number" value={priceLifetime} onChange={(e) => setPriceLifetime(e.target.value)} placeholder="600000" className="input-field" />
                  {priceLifetime && parseInt(priceLifetime) > 0 && <p className="text-xs text-lime mt-1.5 font-medium">{formatPrice(parseInt(priceLifetime))}</p>}
                </div>
              )}
              {(pricingModel === "monthly" || pricingModel === "both") && (
                <div>
                  <label className="block text-xs text-white/40 mb-2">Oylik narx (so'm) *</label>
                  <input type="number" value={priceMonthly} onChange={(e) => setPriceMonthly(e.target.value)} placeholder="100000" className="input-field" />
                  {priceMonthly && parseInt(priceMonthly) > 0 && <p className="text-xs text-lime mt-1.5 font-medium">{formatPrice(parseInt(priceMonthly))} <span className="text-white/40">/oy</span></p>}
                </div>
              )}
              <div className={cn(pricingModel === "both" ? "col-span-2" : "")}>
                <label className="block text-xs text-white/40 mb-2">Daraja</label>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="input-field"><option value="beginner">Boshlang'ich</option><option value="intermediate">O'rta</option><option value="advanced">Professional</option></select>
              </div>
            </div>
          </div>

          {/* Kategoriyalar — ko'p tanlash */}
          <div>
            <label className="block text-xs text-white/40 mb-2">Kategoriyalar * ({categories.length}/2)</label>
            <div className="flex flex-wrap gap-2">
              {SPECIALIZATIONS.map((s) => (
                <button key={s.value} type="button" onClick={() => toggleCategory(s.value)}
                  className={cn("px-3 py-1.5 rounded-full text-xs border transition-all",
                    categories.includes(s.value) ? "border-lime bg-lime-muted text-lime" : "border-white/10 text-white/40 hover:border-white/20")}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Muqova */}
          <div>
            <label className="block text-xs text-white/40 mb-2">Muqova rasmi</label>
            <label className="block w-full aspect-video rounded-xl border-2 border-dashed border-white/10 hover:border-lime/30 cursor-pointer overflow-hidden transition-colors relative group">
              {coverPreview ? (
                <>
                  <img src={coverPreview} alt="" className="w-full h-full object-cover" />
                  {/* Qoplama — hover'da "O'zgartirish" */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <p className="text-xs text-white font-medium">Rasmni o'zgartirish</p>
                  </div>
                  {/* Xavfsiz zona ko'rsatgich */}
                  <div className="absolute inset-4 border-2 border-dashed border-white/20 rounded-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                </>
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-lime/[0.03] to-dark-card flex flex-col items-center justify-center relative">
                  {/* Default fitness shablon */}
                  <div className="w-16 h-16 rounded-2xl bg-lime/10 flex items-center justify-center mb-3">
                    <Dumbbell className="h-8 w-8 text-lime/40" />
                  </div>
                  <p className="text-xs text-white/40 font-medium">Muqova rasmi qo'shish</p>
                  <p className="text-[10px] text-white/20 mt-1">16:9 nisbat tavsiya etiladi (1280×720)</p>
                  {/* Chegara yo'riqnomasi */}
                  <div className="absolute inset-3 border-2 border-dashed border-white/[0.06] rounded-lg pointer-events-none" />
                  <div className="absolute bottom-3 right-3 text-[9px] text-white/15">16:9</div>
                </div>
              )}
              <input type="file" accept="image/*" onChange={handleCover} className="hidden" />
            </label>
            <p className="text-[10px] text-white/20 mt-1.5">JPEG yoki PNG · Tavsiya: 1280×720 piksel</p>
          </div>
        </div>
      </div>

      {/* Bo'limlar (Modullar) */}
      <div className="card p-6 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="font-semibold text-sm">Modullar</h2>
            <p className="text-[10px] text-white/30 mt-0.5">Masalan: "Chest Day", "Leg Day" — har birida alohida video darsliklar</p>
          </div>
          <button onClick={addSection} className="btn-outline !py-1.5 !px-3 text-xs flex items-center gap-1.5"><Plus className="h-3 w-3" />Modul qo'shish</button>
        </div>

        {/* Info box */}
        <div className="bg-lime/[0.03] border border-lime/10 rounded-lg p-3 mb-4">
          <p className="text-[10px] text-lime/60 leading-relaxed">
            Har bir modul — alohida bo'lim. Modulga sarlavha bering (masalan: "Ko'krak mashqlari"), keyin uning ichiga videolar qo'shing (masalan: "Bench Press texnikasi", "Cable Fly").
          </p>
        </div>

        <div className="space-y-5">
          {sections.map((section, index) => (
            <div key={section.id} className="border border-white/[0.06] rounded-xl overflow-hidden">
              {/* Modul header */}
              <div className="flex items-center justify-between px-4 py-3 bg-dark-card/50 border-b border-white/[0.04]">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-lime/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-lime">{index + 1}</span>
                  </div>
                  <span className="text-xs text-white/60 font-medium">{index + 1}-modul</span>
                  {section.videos.length > 0 && <span className="text-[9px] text-white/30 bg-white/[0.04] px-2 py-0.5 rounded-full">{section.videos.length} video</span>}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => moveSection(index, -1)} disabled={index === 0} className="p-1.5 text-white/20 hover:text-white/50 disabled:opacity-20 rounded hover:bg-white/[0.04]"><ChevronUp className="h-3.5 w-3.5" /></button>
                  <button onClick={() => moveSection(index, 1)} disabled={index === sections.length - 1} className="p-1.5 text-white/20 hover:text-white/50 disabled:opacity-20 rounded hover:bg-white/[0.04]"><ChevronDown className="h-3.5 w-3.5" /></button>
                  {sections.length > 1 && <button onClick={() => removeSection(section.id)} className="p-1.5 text-red-400/30 hover:text-red-400 rounded hover:bg-red-500/[0.06]"><Trash2 className="h-3.5 w-3.5" /></button>}
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Modul sarlavhasi va tavsifi */}
                <div className="space-y-2">
                  <input type="text" value={section.title} onChange={(e) => updateSection(section.id, "title", e.target.value)} 
                    placeholder="Modul nomi * (masalan: Ko'krak mashqlari)" className="input-field text-sm font-medium" />
                  <textarea value={section.content} onChange={(e) => updateSection(section.id, "content", e.target.value)} 
                    placeholder="Modul haqida qisqacha (ixtiyoriy)..." rows={2} className="input-field resize-none text-sm" />
                </div>

                {/* Videolar ro'yxati */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Video darsliklar</p>
                    {section.videos.length > 0 && <p className="text-[10px] text-white/20">{section.videos.length} ta video</p>}
                  </div>

                  {section.videos.length > 0 ? (
                    <div className="space-y-2 mb-3">
                      {section.videos.map((video, vi) => (
                        <div key={video.id} className="bg-dark-card border border-white/[0.04] rounded-xl p-3 hover:border-white/[0.08] transition-all">
                          <div className="flex items-start gap-3">
                            {/* Tartib raqami */}
                            <div className="flex flex-col items-center gap-1 pt-1">
                              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold",
                                video.uploading ? "bg-yellow-500/10" : "bg-lime/10")}>
                                {video.uploading ? <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" /> : <span className="text-lime">{vi + 1}</span>}
                              </div>
                              <GripVertical className="h-3 w-3 text-white/10" />
                            </div>

                            {/* Ma'lumotlar */}
                            <div className="flex-1 min-w-0 space-y-1.5">
                              <input type="text" value={video.title} onChange={(e) => updateVideoTitle(section.id, video.id, e.target.value)}
                                className="bg-transparent text-sm text-white/80 w-full outline-none border-b border-white/[0.06] focus:border-lime/30 pb-1 font-medium"
                                placeholder="Video sarlavhasi * (masalan: Bench Press texnikasi)" />
                              <input type="text" value={video.description || ""} onChange={(e) => updateVideoDesc(section.id, video.id, e.target.value)}
                                className="bg-transparent text-[11px] text-white/40 w-full outline-none border-b border-transparent focus:border-white/10 pb-1"
                                placeholder="Qisqacha tavsif (masalan: To'g'ri texnika va keng xatolar)" />
                              {video.uploading && <p className="text-[9px] text-yellow-500">Yuklanmoqda...</p>}
                              {!video.uploading && video.url && <p className="text-[9px] text-lime/50">✓ Video yuklangan</p>}
                            </div>

                            {/* O'chirish */}
                            <button onClick={() => removeVideo(section.id, video.id)} 
                              className="text-red-400/20 hover:text-red-400 shrink-0 p-1 rounded hover:bg-red-500/[0.06] mt-1">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-dark-card/30 rounded-xl p-6 text-center mb-3 border border-dashed border-white/[0.06]">
                      <Video className="h-6 w-6 text-white/10 mx-auto mb-2" />
                      <p className="text-[11px] text-white/30">Bu modulda hali video yo'q</p>
                      <p className="text-[9px] text-white/20 mt-0.5">Pastdagi tugma orqali video qo'shing</p>
                    </div>
                  )}

                  {/* Video qo'shish tugmasi */}
                  <label className="flex items-center gap-3 p-3 border border-dashed border-white/10 rounded-xl hover:border-lime/30 hover:bg-lime/[0.02] transition-all cursor-pointer group">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.04] group-hover:bg-lime/10 flex items-center justify-center transition-colors">
                      <Upload className="h-4 w-4 text-white/30 group-hover:text-lime transition-colors" />
                    </div>
                    <div>
                      <p className="text-xs text-white/50 group-hover:text-white/70 transition-colors font-medium">Video qo'shish</p>
                      <p className="text-[10px] text-white/20">MP4, MOV · Hajmi 500MB gacha</p>
                    </div>
                    <input type="file" accept="video/*" onChange={(e) => handleVideoUpload(section.id, e)} className="hidden" />
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Modul qo'shish — pastda ham */}
        {sections.length > 0 && (
          <button onClick={addSection} className="w-full mt-4 py-3 border border-dashed border-white/[0.06] rounded-xl text-xs text-white/30 hover:text-lime hover:border-lime/30 hover:bg-lime/[0.02] transition-all flex items-center justify-center gap-2">
            <Plus className="h-3.5 w-3.5" />Yangi modul qo'shish
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button onClick={() => handleSave(false)} disabled={saving} className="btn-outline flex items-center gap-2 !py-2.5 text-sm disabled:opacity-50"><Save className="h-4 w-4" />Qoralama</button>
        <button onClick={() => handleSave(true)} disabled={saving} className="btn-lime flex items-center gap-2 !py-2.5 text-sm disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}{saving ? "Saqlanmoqda..." : isEdit ? "Yangilash" : "E'lon qilish"}</button>
      </div>
    </div>
  );
}
