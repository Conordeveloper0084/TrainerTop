"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, MapPin, Dumbbell, ChevronRight, ChevronLeft, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/auth-store";
import { createClient } from "@/lib/supabase/client";
import { SPECIALIZATIONS, CITIES, WORK_TYPES } from "@/lib/constants";

const STEPS = [
  { label: "Asosiy", icon: User },
  { label: "Yo'nalish", icon: Dumbbell },
  { label: "Lokatsiya", icon: MapPin },
];

export default function ProfileSetupPage() {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  // Form state
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [specs, setSpecs] = useState<string[]>([]);
  const [expYears, setExpYears] = useState("1");
  const [workType, setWorkType] = useState("both");
  const [city, setCity] = useState("");
  const [hasGym, setHasGym] = useState(false);
  const [gymName, setGymName] = useState("");
  const [gymAddress, setGymAddress] = useState("");

  const toggleSpec = (s: string) => {
    setSpecs((p) => p.includes(s) ? p.filter((x) => x !== s) : p.length >= 5 ? (toast.error("Ko'pi bilan 5 ta"), p) : [...p, s]);
  };

  const canNext = () => {
    if (step === 0) return fullName.trim().length > 0;
    if (step === 1) return specs.length > 0;
    if (step === 2) return true;
    return true;
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const supabase = createClient();
      if (!user) throw new Error("User topilmadi");

      // Profile yangilash
      await supabase.from("profiles").update({
        full_name: fullName.trim(),
        phone: user.phone,
      }).eq("id", user.id);

      // Trainer profile yangilash
      await supabase.from("trainer_profiles").update({
        age: age ? parseInt(age) : null,
        gender,
        specializations: specs,
        experience_years: parseInt(expYears) || 0,
        work_type: workType,
        city: city || null,
        gym_name: hasGym ? gymName.trim() || null : null,
        gym_address: hasGym ? gymAddress.trim() || null : null,
        is_published: true,
      }).eq("user_id", user.id);

      toast.success("Profil yaratildi!");

      // Redirect
      window.location.href = "/profile";
    } catch (e: any) {
      toast.error(e.message || "Xatolik");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-main py-6 max-w-2xl mx-auto">
      {/* Steps indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
              i <= step ? "bg-lime text-black" : "bg-dark-card text-white/30")}>
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={cn("text-xs hidden sm:block", i <= step ? "text-white/70" : "text-white/30")}>{s.label}</span>
            {i < STEPS.length - 1 && <div className={cn("w-8 h-px", i < step ? "bg-lime" : "bg-white/10")} />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="card p-6 mb-4">
        {step === 0 && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 mb-4">
              <User className="h-5 w-5 text-lime" />
              <div><h2 className="font-semibold">Asosiy ma'lumotlar</h2><p className="text-xs text-white/40">O'zingiz haqingizda ayting</p></div>
            </div>
            <div><label className="block text-xs text-white/40 mb-2">To'liq ismingiz *</label><input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-field" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs text-white/40 mb-2">Yoshingiz</label><input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="25" className="input-field" /></div>
              <div><label className="block text-xs text-white/40 mb-2">Jins</label><div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setGender("male")} className={cn("py-2.5 rounded-input border text-xs", gender === "male" ? "border-lime bg-lime-muted text-lime" : "border-white/10 text-white/40")}>Erkak</button>
                <button type="button" onClick={() => setGender("female")} className={cn("py-2.5 rounded-input border text-xs", gender === "female" ? "border-lime bg-lime-muted text-lime" : "border-white/10 text-white/40")}>Ayol</button>
              </div></div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 mb-4">
              <Dumbbell className="h-5 w-5 text-lime" />
              <div><h2 className="font-semibold">Yo'nalish va tajriba</h2><p className="text-xs text-white/40">Qaysi sohalarda ishlaysiz?</p></div>
            </div>
            <div><label className="block text-xs text-white/40 mb-2">Yo'nalishlar * ({specs.length}/5)</label><div className="flex flex-wrap gap-2">{SPECIALIZATIONS.map((s) => (
              <button key={s.value} type="button" onClick={() => toggleSpec(s.value)}
                className={cn("px-3 py-1.5 rounded-full text-xs border transition-all", specs.includes(s.value) ? "border-lime bg-lime-muted text-lime" : "border-white/10 text-white/40 hover:border-white/20")}>{s.label}</button>
            ))}</div></div>
            <div><label className="block text-xs text-white/40 mb-2">Tajriba (yil)</label><input type="number" value={expYears} onChange={(e) => setExpYears(e.target.value)} min={0} max={50} className="input-field" /></div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 mb-4">
              <MapPin className="h-5 w-5 text-lime" />
              <div><h2 className="font-semibold">Lokatsiya va ish turi</h2><p className="text-xs text-white/40">Qayerda va qanday ishlaysiz?</p></div>
            </div>
            <div><label className="block text-xs text-white/40 mb-2">Ish turi</label><div className="grid grid-cols-3 gap-2">{WORK_TYPES.map((w) => (
              <button key={w.value} type="button" onClick={() => setWorkType(w.value)}
                className={cn("py-2.5 rounded-input border text-xs", workType === w.value ? "border-lime bg-lime-muted text-lime" : "border-white/10 text-white/40")}>{w.label}</button>
            ))}</div></div>
            <div><label className="block text-xs text-white/40 mb-2">Shahar</label><select value={city} onChange={(e) => setCity(e.target.value)} className="input-field"><option value="">Tanlang</option>{CITIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>

            {/* Zal toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-white/[0.06]">
              <div><p className="text-sm">Zalingiz bormi?</p><p className="text-[10px] text-white/30">Ixtiyoriy</p></div>
              <button onClick={() => setHasGym(!hasGym)}
                className={cn("w-10 h-6 rounded-full transition-colors relative", hasGym ? "bg-lime" : "bg-dark-card")}>
                <div className={cn("w-4 h-4 bg-white rounded-full absolute top-1 transition-all", hasGym ? "left-5" : "left-1")} />
              </button>
            </div>

            {hasGym && (
              <div className="space-y-4 animate-fade-in">
                <div><label className="block text-xs text-white/40 mb-2">Zal nomi</label><input type="text" value={gymName} onChange={(e) => setGymName(e.target.value)} placeholder="FitZone Premium" className="input-field" /></div>
                <div><label className="block text-xs text-white/40 mb-2">Zal manzili</label><input type="text" value={gymAddress} onChange={(e) => setGymAddress(e.target.value)} placeholder="Manzil (ixtiyoriy)" className="input-field" /></div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        {step > 0 ? (
          <button onClick={() => setStep(step - 1)} className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white"><ChevronLeft className="h-4 w-4" />Orqaga</button>
        ) : <div />}

        {step < STEPS.length - 1 ? (
          <button onClick={() => canNext() && setStep(step + 1)} disabled={!canNext()}
            className="btn-lime flex items-center gap-1.5 !py-2.5 text-sm disabled:opacity-30">Keyingi<ChevronRight className="h-4 w-4" /></button>
        ) : (
          <button onClick={handleFinish} disabled={saving}
            className="btn-lime flex items-center gap-1.5 !py-2.5 text-sm disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? "Saqlanmoqda..." : "Yakunlash"}
          </button>
        )}
      </div>
    </div>
  );
}
