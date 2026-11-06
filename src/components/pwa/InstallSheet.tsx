"use client";

import { useEffect, useState } from "react";
import { X, Share, SquarePlus, ExternalLink, Download, Smartphone } from "lucide-react";
import { isIOSSafari, isIOSInAppOrOtherBrowser, isAndroid, isStandalone, ANDROID_APP_URL } from "@/lib/pwa";
import { useInstallSheetStore } from "@/lib/store/install-sheet-store";

type Kind = "ios-safari" | "ios-other" | "android" | null;

function useInstallKind() {
  const [kind, setKind] = useState<Kind>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!isStandalone()) {
      if (isIOSSafari()) setKind("ios-safari");
      else if (isIOSInAppOrOtherBrowser()) setKind("ios-other");
      else if (isAndroid()) setKind("android");
    }
    setReady(true);
  }, []);
  return { kind, ready };
}

// Navbar'da hamburger tugmasi yonida turadigan kichik ikonka — bosilsa pastdan chiqadigan oyna
// (InstallSheet) ochiladi. Standalone (allaqachon o'rnatilgan) yoki o'rnatib bo'lmaydigan holatda
// (masalan, desktop) umuman ko'rinmaydi.
export function InstallTrigger({ className }: { className?: string }) {
  const { kind, ready } = useInstallKind();
  const show = useInstallSheetStore((s) => s.show);
  if (!ready || !kind) return null;
  return (
    <button onClick={show} aria-label="Ilova sifatida o'rnatish" title="Ilova sifatida o'rnatish"
      className={className || "p-2 rounded-lg text-lime/70 hover:text-lime hover:bg-lime-subtle transition-colors"}>
      <Smartphone className="h-[18px] w-[18px]" />
    </button>
  );
}

// Hamburger ochiladigan panel ichidagi qator — xuddi shu oynani ochadi. Ko'rinmasa (kerak
// bo'lmagan qurilma/brauzer) chaqiruvchi tomonda bo'sh chiziq qolib ketmasligi uchun, chegara
// chizig'ini ham shu komponentning o'zi (faqat ko'ringanda) chizadi.
export function InstallMenuRow({ onNavigate }: { onNavigate?: () => void }) {
  const { kind, ready } = useInstallKind();
  const show = useInstallSheetStore((s) => s.show);
  if (!ready || !kind) return null;
  return (
    <div className="border-t border-white/[0.06] pt-1 mb-1">
      <button onClick={() => { onNavigate?.(); show(); }} className="flex items-center gap-3 px-4 py-2.5 text-sm text-lime/80 hover:text-lime hover:bg-lime-subtle w-full text-left">
        <Smartphone className="h-4 w-4" />Ilova sifatida o'rnatish
      </button>
    </div>
  );
}

// Pastdan chiqadigan oyna — bitta joyda, root layout'da bir marta render qilinadi. Ikkala trigger
// (InstallTrigger va InstallMenuRow) ham shu bitta ulashilgan holatni ochadi.
export function InstallSheet() {
  const open = useInstallSheetStore((s) => s.open);
  const hide = useInstallSheetStore((s) => s.hide);
  const { kind } = useInstallKind();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={hide}>
      <div
        className="w-full max-w-md bg-dark-surface border-t border-white/[0.08] rounded-t-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-white/15 mx-auto mb-5" />

        <div className="flex items-start justify-between mb-4">
          <h2 className="text-base font-bold">Ilova sifatida o'rnatish</h2>
          <button onClick={hide} aria-label="Yopish" className="text-white/30 hover:text-white -mt-1 -mr-1 p-1"><X className="h-5 w-5" /></button>
        </div>

        {kind === "ios-safari" && (
          <div className="flex items-start gap-3">
            <SquarePlus className="h-5 w-5 text-lime shrink-0 mt-0.5" />
            <p className="text-sm text-white/70 leading-relaxed">
              Pastdagi <Share className="h-4 w-4 inline text-lime -mt-0.5" /> <strong className="text-white">Share</strong> tugmasini bosing, so'ng <strong className="text-white">"Bosh ekranga qo'shish"</strong> (Add to Home Screen) ni tanlang.
            </p>
          </div>
        )}
        {kind === "ios-other" && (
          <div className="flex items-start gap-3">
            <ExternalLink className="h-5 w-5 text-lime shrink-0 mt-0.5" />
            <p className="text-sm text-white/70 leading-relaxed">
              iOS'da ilova sifatida o'rnatish faqat <strong className="text-white">Safari</strong> brauzerida ishlaydi. Havolani nusxalab Safari'da oching.
            </p>
          </div>
        )}
        {kind === "android" && (
          <div className="flex items-start gap-3">
            <Download className="h-5 w-5 text-lime shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-white/70 leading-relaxed mb-3">TrainerTop Android ilovasi Play Market'da mavjud.</p>
              <a href={ANDROID_APP_URL} target="_blank" rel="noopener noreferrer" onClick={hide} className="btn-lime inline-flex items-center gap-2 !py-2.5 text-sm">
                <Download className="h-4 w-4" />Play Market'dan yuklab olish
              </a>
            </div>
          </div>
        )}
        {!kind && <p className="text-sm text-white/40">Bu qurilmada o'rnatish imkoni yo'q.</p>}
      </div>
    </div>
  );
}
