"use client";

import Link from "next/link";
import { Dumbbell, History, TrendingUp, Trophy } from "lucide-react";

// Mehmon "Kundalik"ni ochsa — nima ekanini tushuntiradi va kirishga taklif qiladi (ma'lumot saqlanishi uchun akkaunt kerak)
export function WorkoutGate() {
  const items = [
    { icon: Dumbbell, t: "Programma va kunlar", d: "PPL, Upper/Lower... mashqlarni o'z so'zingiz bilan yozing" },
    { icon: History, t: "Oldingi natija doim ko'z oldida", d: "Oxirgi safar qancha ko'targaningizni eslab qolish shart emas" },
    { icon: Trophy, t: "Yutuqlar va rekordlar", d: "Vazn yoki takror oshsa — darhol ko'rasiz" },
    { icon: TrendingUp, t: "Hisobot", d: "Boshlaganingizdan beri o'sish, PDF va trenerga yuborish" },
  ];
  return (
    <div className="container-main py-8 max-w-xl" data-testid="workout-gate">
      <h1 className="text-page-title text-white mb-2">Kundalik</h1>
      <p className="text-sm text-white/40 mb-6">Zaldagi mashg'ulotlaringizni yozib boring va kuchingiz qanday oshayotganini kuzating.</p>
      <div className="card p-5 space-y-4 mb-6">
        {items.map((x) => (
          <div key={x.t} className="flex gap-3">
            <div className="h-9 w-9 shrink-0 rounded-xl bg-lime-muted flex items-center justify-center"><x.icon className="h-4 w-4 text-lime" /></div>
            <div><p className="text-sm font-semibold text-white">{x.t}</p><p className="text-xs text-white/40">{x.d}</p></div>
          </div>
        ))}
      </div>
      <Link href="/login?redirect=/workouts" className="btn-lime w-full !py-3 text-sm block text-center">Kirish va boshlash</Link>
      <p className="text-center text-xs text-white/30 mt-3">Bepul. Natijalaringiz faqat sizga ko'rinadi.</p>
    </div>
  );
}
