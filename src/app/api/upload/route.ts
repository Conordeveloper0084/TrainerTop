import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from "@/lib/r2";
import { getApiUser } from "@/lib/supabase/api-auth";
import { getUserRole, canUploadVideo } from "@/lib/media";
import { randomUUID } from "crypto";

const ALLOWED_FOLDERS = ["avatars", "posts", "lessons", "gyms", "chat", "uploads", "channel"];
const VIDEO_EXT: Record<string, string> = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "video/x-m4v": "m4v" };
const IMAGE_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
// Ovozli xabarlar (faqat chat papkasiga). MediaRecorder turi "audio/webm;codecs=opus" kabi kelishi mumkin — asosiy qismi olinadi.
const AUDIO_EXT: Record<string, string> = { "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/aac": "aac", "audio/mpeg": "mp3", "audio/wav": "wav" };

// POST /api/upload — Kichik fayllar (rasmlar, < 4MB)
// HAM website (cookie) HAM app (Bearer token) uchun ishlaydi.
// Katta fayllar (video) → /api/upload/init (presigned) → /complete
export async function POST(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const requestedFolder = (formData.get("bucket") as string) || "avatars";
    const folder = ALLOWED_FOLDERS.includes(requestedFolder) ? requestedFolder : "uploads";

    if (!file) return NextResponse.json({ message: "Fayl tanlanmagan" }, { status: 400 });

    const mime = (file.type || "").split(";")[0].trim().toLowerCase();
    const isChat = folder === "chat";
    const isVideo = !!VIDEO_EXT[mime];
    const isImage = !!IMAGE_EXT[mime];
    const isAudio = isChat && !!AUDIO_EXT[mime];
    if (!isVideo && !isImage && !isAudio) {
      return NextResponse.json({ message: "Faqat JPG, PNG, WebP rasm yoki MP4, MOV, WebM video" }, { status: 400 });
    }

    // Video profil/post/darslik uchun faqat trenerlar; chatda hamma yubora oladi
    if (isVideo && !isChat) {
      const role = await getUserRole(user.id);
      if (!canUploadVideo(role, folder)) {
        return NextResponse.json({ message: "Bu yerga video yuklash faqat trenerlar uchun" }, { status: 403 });
      }
    }

    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json({ message: "4MB dan katta fayllar uchun chunked upload ishlatiladi" }, { status: 413 });
    }

    const ext = isAudio ? AUDIO_EXT[mime] : isVideo ? VIDEO_EXT[mime] : IMAGE_EXT[mime];
    const prefix = isAudio ? "voice" : isVideo ? "video" : "img";
    // Chat fayllari shaxsiy (tana rasmlari, ovoz): nomi TAXMIN QILIB BO'LMAYDIGAN tasodifiy bo'ladi
    const key = isChat ? `${folder}/${user.id}/${prefix}-${randomUUID()}.${ext}` : `${folder}/${user.id}/${prefix}-${Date.now()}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mime,
        CacheControl: "public, max-age=31536000",
      })
    );

    return NextResponse.json({ url: `${R2_PUBLIC_URL}/${key}`, path: key });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ message: "Yuklashda xatolik" }, { status: 500 });
  }
}
