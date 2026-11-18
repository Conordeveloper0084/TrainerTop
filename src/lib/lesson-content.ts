// Pullik darslik kontentini himoyalash: xaridor (yoki egasi/admin) bo'lmagan odamga faqat
// modul va video SARLAVHALARI ko'rsatiladi. Video havolalari, matnlar, rasmlar, tavsiflar YUBORILMAYDI.
export interface LockedSection { title: string; videos: { title: string }[]; locked: true }

export function stripLessonContent(content: any): { sections: LockedSection[] } {
  const sections: any[] = Array.isArray(content?.sections) ? content.sections : [];
  return {
    sections: sections.map((s: any) => ({
      title: typeof s?.title === "string" ? s.title : "",
      videos: Array.isArray(s?.videos) ? s.videos.map((v: any) => ({ title: typeof v?.title === "string" ? v.title : "" })) : [],
      locked: true as const,
    })),
  };
}
