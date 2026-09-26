import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { tgFetchFile } from "@/lib/telegram";

// GET /api/admin/support/tg-file?file_id=... — Telegramdagi rasm/faylni admin uchun ko'rsatadi.
// Bot tokeni brauzerga CHIQMAYDI: fayl serverdan oqib o'tadi. Faqat admin.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
  const fileId = new URL(request.url).searchParams.get("file_id") || "";
  if (!/^[A-Za-z0-9_\-]{10,300}$/.test(fileId)) return NextResponse.json({ message: "file_id noto'g'ri" }, { status: 400 });
  const f = await tgFetchFile(fileId);
  if (!f) return NextResponse.json({ message: "Faylni olib bo'lmadi" }, { status: 404 });
  // Xavfsizlik: foydalanuvchi yuborgan fayl bizning domenimizda skript ishga tushirmasin (masalan, .html/.svg).
  // Faqat oddiy rasmlar ekranda ochiladi; qolganlari yuklab olinadi.
  const safeImage = /^image\/(jpeg|png|webp|gif)$/i.test(f.contentType);
  return new NextResponse(f.body, { headers: {
    "Content-Type": safeImage ? f.contentType : "application/octet-stream",
    ...(safeImage ? {} : { "Content-Disposition": "attachment" }),
    "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff",
  } });
}
