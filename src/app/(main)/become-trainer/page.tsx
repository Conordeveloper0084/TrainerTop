"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dumbbell, CheckCircle, Loader2, ArrowRight, Star, Users, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth-store";

export default function BecomeTrainerPage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { user, setUser, setTrainerProfile } = useAuthStore();

  const handleBecomeTrainer = async () => {
    if (!user) {
      router.push("/login");
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createClient();

      // 1. Profileni trainer qilib yangilash
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ role: "trainer" })
        .eq("id", user.id);

      if (profileError) {
        throw new Error("Profilni yangilashda xatolik");
      }

      // 2. Trainer profile yaratish (agar yo'q bo'lsa)
      const { data: existingTP } = await supabase
        .from("trainer_profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!existingTP) {
        const { error: tpError } = await supabase
          .from("trainer_profiles")
          .insert({ user_id: user.id });

        if (tpError) {
          throw new Error("Trener profil yaratishda xatolik");
        }
      }

      // 3. Store yangilash
      setUser({ ...user, role: "trainer" });

      const { data: tp } = await supabase
        .from("trainer_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (tp) setTrainerProfile(tp);

      toast.success("Tabriklaymiz! Siz endi trenersiz!");
      router.push("/profile/setup");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Xatolik yuz berdi");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container-main py-8">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-lime-muted flex items-center justify-center mx-auto mb-4">
            <Dumbbell className="h-7 w-7 text-lime" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Trener bo'ling!</h1>
          <p className="text-white/40 text-sm max-w-sm mx-auto">
            O'z profilingizni oching, shogirdlar toping, darsliklar soting — barchasi bitta platformada
          </p>
        </div>

        {/* Afzalliklar */}
        <div className="space-y-3 mb-8">
          <BenefitCard
            icon={Users}
            title="Shogirdlar toping"
            description="Minglab foydalanuvchilar orasidan sizga mos shogirdlar"
          />
          <BenefitCard
            icon={BookOpen}
            title="Darsliklar soting"
            description="Video va matnli darsliklar yarating, daromad oling"
          />
          <BenefitCard
            icon={Star}
            title="Reyting yig'ing"
            description="Sharhlar va reytinglar orqali ishonch hosil qiling"
          />
        </div>

        {/* CTA */}
        <div className="card p-6 text-center">
          <p className="text-sm text-white/50 mb-4">
            Trener bo'lish <span className="text-lime font-medium">bepul</span>. 
            Faqat darslik sotilganda 10% komissiya olinadi.
          </p>
          <button
            onClick={handleBecomeTrainer}
            disabled={isLoading}
            className="btn-lime w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            {isLoading ? "Yuklanmoqda..." : "Trener bo'lish"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BenefitCard({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="card p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-lime-subtle flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5 text-lime/70" />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-white/40">{description}</p>
      </div>
      <CheckCircle className="h-4 w-4 text-lime/40 shrink-0 ml-auto" />
    </div>
  );
}
