"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { splitHashtags } from "@/lib/post-text";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Post matni (Android/iOS bilan bir xil):
//  • kartaning butun eni bo'ylab BITTA oqim: [muallif ismi qalin] + bo'sh joy + matn;
//  • asosiy matn rangi yorqin; #hashtag'lar ko'k (faqat rang, bosilmaydi);
//  • `maxLines` qatordan oshsa, oxirgi qator oxirida "… yana" — bosilsa to'liq ochiladi (qayta yig'ilmaydi).
//    Kesilgani belgilar soni bilan EMAS, haqiqiy joylashuv bo'yicha aniqlanadi (scrollHeight > clientHeight).
//  • `large` — faqat matnli post: kattaroq shrift (16px / 23px), muallif ismi takrorlanmaydi.
export function PostCaption({ text, authorName, maxLines, large = false, className }: { text: string; authorName?: string | null; maxLines: number; large?: boolean; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const parts = useMemo(() => splitHashtags(text), [text]);
  const lineHeight = large ? 23 : 20;

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const measure = () => setClamped(el.scrollHeight > el.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);      // eni o'zgarsa (ekran aylansa, oyna kichraysa) qayta o'lchanadi
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, authorName, maxLines, large, expanded]);

  const expand = () => setExpanded(true);
  const collapsed = clamped && !expanded;
  return (
    // Tashqi blok — joylashuv (chetdan bo'sh joy) uchun; ichki blok — "… yana" aynan matnning oxirgi qatori oxirida turishi uchun
    <div className={className} data-testid="post-caption">
      <div className="relative">
        <p
          ref={ref}
          onClick={collapsed ? expand : undefined}
          data-testid="post-caption-text"
          data-expanded={expanded ? "true" : "false"}
          className={cn("whitespace-pre-line break-words text-white", large ? "text-[16px]" : "text-sm", collapsed && "cursor-pointer")}
          style={{ lineHeight: `${lineHeight}px`, ...(expanded ? {} : { maxHeight: maxLines * lineHeight, overflow: "hidden" }) }}
        >
          {authorName ? <><span className="font-semibold">{authorName}</span>{" "}</> : null}
          {parts.map((p, i) => (p.tag ? <span key={i} className="post-hashtag">{p.text}</span> : <span key={i}>{p.text}</span>))}
        </p>
        {collapsed && (
          <button type="button" onClick={expand} aria-label="Matnni to'liq ko'rsatish" data-testid="post-more"
            className={cn("post-more absolute bottom-0 right-0 pl-9", large ? "text-[16px]" : "text-sm")} style={{ lineHeight: `${lineHeight}px` }}>… yana</button>
        )}
      </div>
    </div>
  );
}
