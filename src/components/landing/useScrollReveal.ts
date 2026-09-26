"use client";

import { useEffect } from "react";

/**
 * .reveal klassiga ega elementlarni kuzatadi va ko'ringanda .is-visible qo'shadi.
 * Muhim: kechroq (API'dan keyin) qo'shilgan elementlar uchun ham qayta ishlaydi.
 */
export function useScrollReveal() {
  useEffect(() => {
    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );

    // Barcha reveal elementlarni kuzatish
    const observeAll = () => {
      document.querySelectorAll(".reveal:not(.is-visible)").forEach((el) => observer.observe(el));
    };
    observeAll();

    // Kechroq qo'shilgan elementlar uchun (API javobi keyin keladi) — DOM o'zgarishini kuzatish
    const mo = new MutationObserver(() => observeAll());
    mo.observe(document.body, { childList: true, subtree: true });

    // Xavfsizlik: 3 soniyadan keyin hali ko'rinmagan hamma narsani majburan ko'rsatish
    const safety = setTimeout(() => {
      document.querySelectorAll(".reveal:not(.is-visible)").forEach((el) => el.classList.add("is-visible"));
    }, 3000);

    return () => {
      observer.disconnect();
      mo.disconnect();
      clearTimeout(safety);
    };
  }, []);
}
