"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth-store";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const store = useAuthStore.getState();
    const supabase = createClient();

    // HIMOYA: 3 soniyadan keyin har qanday holatda ready bo'ladi
    const safetyTimer = setTimeout(() => {
      if (!useAuthStore.getState().ready) {
        console.warn("Auth: safety timeout — marking ready");
        useAuthStore.getState().setReady();
      }
    }, 3000);

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          // Profile olish
          let retries = 3;
          let profile = null;

          while (retries > 0 && !profile) {
            const { data } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", session.user.id)
              .maybeSingle();
            profile = data;
            if (!profile) {
              retries--;
              await new Promise((r) => setTimeout(r, 500));
            }
          }

          if (profile) {
            store.setUser(profile);

            // Qo'shimcha profil
            if (profile.role === "trainer") {
              const { data: tp } = await supabase
                .from("trainer_profiles")
                .select("*")
                .eq("user_id", session.user.id)
                .maybeSingle();
              if (tp) store.setTrainerProfile(tp);
            } else {
              const { data: up } = await supabase
                .from("user_profiles")
                .select("*")
                .eq("user_id", session.user.id)
                .maybeSingle();
              if (up) store.setUserProfile(up);
            }
          }
        }
      } catch (e) {
        console.error("Auth init error:", e);
      }

      store.setReady();
      clearTimeout(safetyTimer);
    };

    init();

    // Logout kuzatish
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        useAuthStore.getState().logout();
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  return <>{children}</>;
}
