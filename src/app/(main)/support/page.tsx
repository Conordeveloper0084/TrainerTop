"use client";

import { useState } from "react";
import { Headphones, Send, Loader2, MessageCircle, Mail, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function SupportPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !email || !message) {
      toast.error("Iltimos, barcha maydonlarni to'ldiring");
      return;
    }

    setIsSubmitting(true);
    // TODO: Backend API ga yuborish
    await new Promise((r) => setTimeout(r, 1500));
    setIsSubmitted(true);
    setIsSubmitting(false);
  };

  if (isSubmitted) {
    return (
      <div className="container-main py-8">
        <div className="max-w-lg mx-auto text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-lime-muted flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-7 w-7 text-lime" />
          </div>
          <h1 className="text-xl font-bold mb-2">Xabaringiz yuborildi!</h1>
          <p className="text-sm text-white/40 mb-6">
            Tez orada siz bilan bog'lanamiz. Odatda 24 soat ichida javob beramiz.
          </p>
          <button
            onClick={() => {
              setIsSubmitted(false);
              setName("");
              setEmail("");
              setSubject("");
              setMessage("");
            }}
            className="btn-outline text-sm"
          >
            Yana xabar yuborish
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container-main py-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-lime-muted flex items-center justify-center mx-auto mb-4">
            <Headphones className="h-6 w-6 text-lime" />
          </div>
          <h1 className="text-h1 mb-2">Yordam markazi</h1>
          <p className="text-white/40 text-sm">
            Savolingiz bormi? Biz yordam berishga tayyormiz.
          </p>
        </div>

        {/* Kontakt ma'lumotlari */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="card p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-lime-subtle flex items-center justify-center shrink-0">
              <MessageCircle className="h-5 w-5 text-lime/70" />
            </div>
            <div>
              <p className="text-sm font-medium">Telegram</p>
              <a
                href="https://t.me/trainertop_support"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-lime hover:underline"
              >
                @trainertop_support
              </a>
            </div>
          </div>
          <div className="card p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-lime-subtle flex items-center justify-center shrink-0">
              <Mail className="h-5 w-5 text-lime/70" />
            </div>
            <div>
              <p className="text-sm font-medium">Email</p>
              <a href="mailto:support@trainertop.uz" className="text-xs text-lime hover:underline">
                support@trainertop.uz
              </a>
            </div>
          </div>
        </div>

        {/* Forma */}
        <div className="card p-6">
          <h2 className="font-semibold text-sm mb-5">Xabar yuborish</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-white/40 mb-2">Ismingiz *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ismingiz"
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-2">Email *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="input-field"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-2">Mavzu</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="input-field"
              >
                <option value="">Tanlang</option>
                <option value="general">Umumiy savol</option>
                <option value="payment">To'lov muammosi</option>
                <option value="account">Akkaunt muammosi</option>
                <option value="trainer">Trener bo'lish</option>
                <option value="bug">Xatolik xabari</option>
                <option value="suggestion">Taklif</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-2">Xabar *</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Savolingiz yoki muammoni batafsil yozing..."
                rows={5}
                className="input-field resize-none"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-lime flex items-center justify-center gap-2 w-full sm:w-auto disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {isSubmitting ? "Yuborilmoqda..." : "Yuborish"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
