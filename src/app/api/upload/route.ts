import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from "@/lib/r2";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// POST /api/upload — Kichik fayllar (rasmlar, < 4MB)
// Katta fayllar (video) → /api/upload/init → /part → /complete
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const folder = (formData.get("bucket") as string) || "avatars";

    if (!file) return NextResponse.json({ message: "Fayl tanlanmagan" }, { status: 400 });

    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) {
      return NextResponse.json({ message: "Faqat rasm yoki video" }, { status: 400 });
    }

    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json({ message: "4MB dan katta fayllar uchun chunked upload ishlatiladi" }, { status: 413 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || (isVideo ? "mp4" : "jpg");
    const prefix = isVideo ? "video" : "img";
    const key = `${folder}/${user.id}/${prefix}-${Date.now()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type,
        CacheControl: "public, max-age=31536000",
      })
    );

    const publicUrl = `${R2_PUBLIC_URL}/${key}`;
    return NextResponse.json({ url: publicUrl, path: key });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ message: error.message || "Yuklash xatolik" }, { status: 500 });
  }
}
