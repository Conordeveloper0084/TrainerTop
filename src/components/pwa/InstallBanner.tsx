"use client";

import { useEffect, useState } from "react";
import { SquarePlus, Download } from "lucide-react";
import { isIOSSafari, isIOSInAppOrOtherBrowser, isAndroid, isStandalone, ANDROID_APP_URL } from "@/lib/pwa";

export { ANDROID_APP_URL };

type Kind = "ios-safari" | "ios-other" | "android" | null;

// Profil → Sozlamalar uchun doimiy band (bosh sahifadagi katta bannerning o'rnini Navbar'dagi
// ikonka + pastdan chiqadigan oyna (InstallSheet) oldi — qarang components/pwa/InstallSheet.tsx).
export function InstallMenuItem() {
  const [kind, setKind] = useState<Kind>(null);

  useEffect(() => {
    if (isStandalone()) return;
    if (isIOSSafari()) setKind("ios-safari");
    else if (isIOSInAppOrOtherBrowser()) setKind("ios-other");
    else if (isAndroid()) setKind("android");
  }, []);

  if (!kind) return null;

  if (kind === "android") {
    return (
      <a href={ANDROID_APP_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-sm text-white/70 hover:text-lime transition-colors">
        <Download className="h-4 w-4" />Android ilovasini yuklab olish
      </a>
    );
  }
  return (
    <div className="flex items-center gap-2.5 text-sm text-white/70">
      <SquarePlus className="h-4 w-4" />
      {kind === "ios-safari" ? "Ilova sifatida o'rnatish: Share → Bosh ekranga qo'shish" : "O'rnatish uchun Safari'da oching"}
    </div>
  );
}
