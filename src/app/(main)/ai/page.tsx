"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Dumbbell, Apple, Target, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const QUICK_PROMPTS = [
  { icon: Dumbbell, label: "Mashq rejasi", prompt: "Boshlanuvchi uchun haftalik mashq rejasi tuzib ber" },
  { icon: Apple, label: "Dieta maslahat", prompt: "Vazn tashlash uchun kunlik ovqatlanish rejasi ber" },
  { icon: Target, label: "Mushak o'stirish", prompt: "Mushak massasini oshirish uchun maslahat ber" },
];

export default function AIPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // Simulate AI response (TODO: OpenAI API integratsiya)
    setTimeout(() => {
      const responses: Record<string, string> = {
        default: `Yaxshi savol! Men sizga fitness bo'yicha maslahat bera olaman.\n\nQuyidagilarni sinab ko'ring:\n\n1. Har kuni kamida 30 daqiqa jismoniy mashq qiling\n2. Yetarli suv iching (kuniga 2-3 litr)\n3. Oqsilli ovqatlar iste'mol qiling\n4. Yetarli uxlang (7-8 soat)\n\nAniqroq savol bersangiz, shaxsiy maslahat bera olaman! 💪`,
      };

      const aiMsg: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: text.toLowerCase().includes("mashq")
          ? `Mana sizga boshlanuvchi uchun haftalik mashq rejasi:\n\n📅 Dushanba — Ko'krak + Triceps\n• Bench press — 3x10\n• Dumbbell fly — 3x12\n• Tricep pushdown — 3x12\n\n📅 Seshanba — Orqa + Biceps\n• Lat pulldown — 3x10\n• Barbell row — 3x10\n• Bicep curl — 3x12\n\n📅 Chorshanba — Dam olish\n\n📅 Payshanba — Yelka + Press\n• Overhead press — 3x10\n• Lateral raise — 3x15\n• Plank — 3x60 soniya\n\n📅 Juma — Oyoq\n• Squat — 4x10\n• Leg press — 3x12\n• Leg curl — 3x12\n\n📅 Shanba — Kardio\n• 30 daqiqa yugurish yoki velosiped\n\n📅 Yakshanba — Dam olish\n\nHar mashqdan oldin 5-10 daqiqa isitish mashqi qiling! 🔥`
          : text.toLowerCase().includes("dieta") || text.toLowerCase().includes("ovqat")
          ? `Vazn tashlash uchun kunlik ovqatlanish rejasi:\n\n🌅 Nonushta (8:00)\n• Tuxum omleti (2 ta) + sabzavot\n• Non — 1 bo'lak\n• Yashil choy\n\n🕐 Tushlik (13:00)\n• Tovuq ko'kragi — 150g\n• Guruch — 100g\n• Salat (pomidor, bodring, ko'kat)\n\n🍎 Snack (16:00)\n• Yong'oq — 30g\n• Meva (olma yoki banan)\n\n🌙 Kechki ovqat (19:00)\n• Baliq — 150g\n• Bug'langan sabzavotlar\n• Salat\n\n💧 Suv: kuniga 2.5-3 litr\n\nUmumiy kaloriya: ~1800 kcal\nOqsil: ~130g | Yog': ~60g | Uglevodlar: ~200g\n\nBu rejani o'z vazningiz va maqsadingizga qarab o'zgartirish mumkin! 📊`
          : text.toLowerCase().includes("mushak")
          ? `Mushak massasini oshirish uchun asosiy maslahatlar:\n\n🏋️ Mashq:\n• Og'ir compound mashqlar (squat, deadlift, bench press)\n• Har mushak guruhiga haftada 2 marta mashq\n• Progressiv overload — har hafta og'irlikni biroz oshiring\n• Har mashqda 3-4 set, 8-12 takror\n\n🍗 Ovqatlanish:\n• Kaloriya surplus — kuniga +300-500 kcal ortiqcha\n• Oqsil — har kg vazniga 1.6-2g (80kg = 130-160g oqsil)\n• Karbohidrat — energiya uchun yetarli\n\n😴 Dam olish:\n• 7-8 soat uxlash MAJBURIY\n• Mashq qilmagan kunlarda to'liq dam oling\n• Stress kamroq — kortizol mushak o'sishiga to'sqinlik qiladi\n\n📈 Natija:\n• Birinchi 3 oyda 3-5kg mushak massasi oshishi mumkin\n• 6 oyda ko'zga ko'rinadigan o'zgarish\n• Sabr qiling — bu marafon, sprint emas! 💪`
          : responses.default,
      };

      setMessages((prev) => [...prev, aiMsg]);
      setIsLoading(false);
    }, 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="container-main py-4 sm:py-8">
      <div className="max-w-2xl mx-auto" style={{ height: "calc(100vh - 120px)" }}>
        <div className="card flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 p-4 border-b border-white/[0.06]">
            <div className="w-9 h-9 rounded-xl bg-lime-muted flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-lime" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">AI Fitness Assistant</h1>
              <p className="text-[10px] text-lime">Har doim tayyor</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-lime-muted flex items-center justify-center mb-4">
                  <Sparkles className="h-7 w-7 text-lime" />
                </div>
                <h2 className="text-lg font-bold mb-1">Salom! 👋</h2>
                <p className="text-sm text-white/40 text-center max-w-sm mb-8">
                  Men sizning fitness assistantingizman. Mashq, dieta, sog'lom turmush
                  haqida savol bering.
                </p>

                {/* Quick prompts */}
                <div className="flex flex-col gap-2 w-full max-w-sm">
                  {QUICK_PROMPTS.map((qp) => (
                    <button
                      key={qp.label}
                      onClick={() => sendMessage(qp.prompt)}
                      className="card-hover p-3 flex items-center gap-3 text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-lime-subtle flex items-center justify-center shrink-0">
                        <qp.icon className="h-4 w-4 text-lime/60" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{qp.label}</p>
                        <p className="text-[10px] text-white/30 line-clamp-1">{qp.prompt}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-3",
                      msg.role === "user"
                        ? "bg-lime text-black rounded-br-md"
                        : "bg-dark-card text-white/80 rounded-bl-md"
                    )}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-line">
                      {msg.content}
                    </p>
                  </div>
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-dark-card rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 text-lime animate-spin" />
                    <span className="text-xs text-white/30">O'ylayapman...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-white/[0.06]">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Fitness haqida savol bering..."
                rows={1}
                className="input-field !py-2.5 resize-none flex-1 text-sm"
                style={{ maxHeight: "100px" }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                className="btn-lime !p-2.5 disabled:opacity-30"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[10px] text-white/15 mt-2 text-center">
              AI maslahatchi — shifokor maslahatini almashtirmaydi
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
