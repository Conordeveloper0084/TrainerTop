import { NextRequest, NextResponse } from "next/server";
import { CreateMultipartUploadCommand, UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from "@/lib/r2";
import { getApiUser } from "@/lib/supabase/api-auth";
import { getUserRole, canUploadVideo } from "@/lib/media";
import { UPLOAD_PART_SIZE, VIDEO_POST_MAX_BYTES, LESSON_VIDEO_MAX_BYTES, CHAT_VIDEO_MAX_BYTES } from "@/lib/constants";
import { randomUUID } from "crypto";

const ALLOWED_FOLDERS = ["avatars", "posts", "lessons", "gyms", "chat", "uploads", "channel"];
const VIDEO_EXT: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-m4v": "m4v",
};
const IMAGE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

// POST /api/upload/init — multipart upload boshlash (cookie yoki Bearer token)
//
// Ikki rejim:
// 1) `size` yuborilsa (YANGI, tavsiya etiladi): javobda har bir bo'lak uchun presigned PUT URL bor.
//    Brauzer/app bo'laklarni TO'G'RIDAN-TO'G'RI R2'ga yuboradi (Vercel 4.5MB limitiga tushmaydi).
// 2) `size` yo'q (ESKI): faqat uploadId qaytadi, bo'laklar /api/upload/part orqali yuboriladi.
export async function POST(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { fileName, fileType, folder, size } = body as {
      fileName?: string; fileType?: string; folder?: string; size?: number;
    };
    if (!fileName || !fileType) {
      return NextResponse.json({ message: "fileName va fileType kerak" }, { status: 400 });
    }

    const isVideo = !!VIDEO_EXT[fileType];
    const isImage = !!IMAGE_EXT[fileType];
    if (!isVideo && !isImage) {
      return NextResponse.json({ message: "Faqat MP4, MOV, WebM video yoki JPG, PNG, WebP rasm" }, { status: 400 });
    }

    const safeFolder = ALLOWED_FOLDERS.includes(folder || "") ? (folder as string) : "uploads";

    // Video posts/darslik uchun faqat trener va admin; chatda hamma yubora oladi
    if (isVideo && safeFolder !== "chat") {
      const role = await getUserRole(user.id);
      if (!canUploadVideo(role, safeFolder)) {
        return NextResponse.json({ message: "Bu yerga video yuklash faqat trenerlar uchun" }, { status: 403 });
      }
    }

    // Hajm cheklovi (size yuborilgan bo'lsa)
    const hasSize = size !== undefined && size !== null;
    let fileSize = 0;
    if (hasSize) {
      fileSize = Number(size);
      if (!Number.isFinite(fileSize) || fileSize <= 0) {
        return NextResponse.json({ message: "size noto'g'ri" }, { status: 400 });
      }
      const maxBytes = isVideo
        ? (safeFolder === "lessons" ? LESSON_VIDEO_MAX_BYTES : safeFolder === "chat" ? CHAT_VIDEO_MAX_BYTES : VIDEO_POST_MAX_BYTES)
        : 20 * 1024 * 1024;
      if (fileSize > maxBytes) {
        return NextResponse.json(
          { message: `Fayl juda katta (maksimum ${Math.round(maxBytes / 1024 / 1024)} MB)` },
          { status: 413 }
        );
      }
    }

    const ext = isVideo ? VIDEO_EXT[fileType] : IMAGE_EXT[fileType];
    const prefix = isVideo ? "video" : "img";
    // Chat fayllari shaxsiy: nomi taxmin qilib bo'lmaydigan tasodifiy
    const key = safeFolder === "chat" ? `${safeFolder}/${user.id}/${prefix}-${randomUUID()}.${ext}` : `${safeFolder}/${user.id}/${prefix}-${Date.now()}.${ext}`;

    const { UploadId } = await r2Client.send(
      new CreateMultipartUploadCommand({
        Bucket: R2_BUCKET,
        Key: key,
        ContentType: fileType,
        CacheControl: "public, max-age=31536000",
      })
    );
    if (!UploadId) throw new Error("UploadId olinmadi");

    const result: Record<string, unknown> = {
      uploadId: UploadId,
      key,
      publicUrl: `${R2_PUBLIC_URL}/${key}`,
    };

    if (hasSize) {
      const partSize = UPLOAD_PART_SIZE;
      const totalParts = Math.ceil(fileSize / partSize);
      const parts = await Promise.all(
        Array.from({ length: totalParts }, async (_, i) => {
          const partNumber = i + 1;
          const url = await getSignedUrl(
            r2Client,
            new UploadPartCommand({ Bucket: R2_BUCKET, Key: key, UploadId, PartNumber: partNumber }),
            { expiresIn: 60 * 60 }
          );
          return { partNumber, url };
        })
      );
      result.partSize = partSize;
      result.parts = parts;
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Init error:", error);
    return NextResponse.json({ message: "Yuklashni boshlashda xatolik" }, { status: 500 });
  }
}
