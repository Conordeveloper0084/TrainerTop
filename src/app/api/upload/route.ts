import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from "@/lib/r2";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Next.js body size limit
export const runtime = "nodejs";
export const maxDuration = 300; // 5 daqiqa timeout

// POST /api/upload — Rasm yoki video yuklash (Cloudflare R2)
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const folder = (formData.get("bucket") as string) || "avatars";

    if (!file) return NextResponse.json({ message: "Fayl tanlanmagan" }, { status: 400 });

    // Hajm tekshirish — rasm 10MB, video 500MB
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    const maxSize = isVideo ? 500 * 1024 * 1024 : 10 * 1024 * 1024;

    if (!isVideo && !isImage) {
      return NextResponse.json({ message: "Faqat rasm yoki video format" }, { status: 400 });
    }

    if (file.size > maxSize) {
      return NextResponse.json({ message: `Fayl ${isVideo ? "500MB" : "10MB"} dan katta` }, { status: 400 });
    }

    // Fayl nomi — folder/userId/type-timestamp.ext
    const ext = file.name.split(".").pop() || (isVideo ? "mp4" : "jpg");
    const prefix = isVideo ? "video" : "img";
    const key = `${folder}/${user.id}/${prefix}-${Date.now()}.${ext}`;

    // File → Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // R2'ga yuklash
    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type,
        CacheControl: "public, max-age=31536000", // 1 yil cache
      })
    );

    // Public URL
    const publicUrl = `${R2_PUBLIC_URL}/${key}`;

    return NextResponse.json({
      url: publicUrl,
      path: key,
      type: isVideo ? "video" : "image",
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ message: "Yuklashda xatolik: " + (error.message || "Server xatolik") }, { status: 500 });
  }
}
