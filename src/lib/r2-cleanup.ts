import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET } from "@/lib/r2";
import { keyFromPublicUrl } from "@/lib/media";

// Bazadagi yozuvlar o'chirilgandan KEYIN chaqiriladi (R2 Postgres tranzaksiyasining bir qismi
// bo'la olmaydi — ikkita alohida tizim). Eng ko'p 1000 ta kalit bitta so'rovda (S3/R2 cheklovi) —
// shuning uchun 1000 tadan bo'lib yuboriladi. Bitta partiya xato bersa ham qolganlari davom etadi;
// natijada nechta o'chgani va muvaffaqiyatsiz kalitlar ro'yxati qaytadi (best-effort — DB allaqachon
// o'zgargan, shuning uchun bu yerdagi xato butun operatsiyani "bekor qilolmaydi").
export interface R2CleanupResult { requested: number; deleted: number; failedKeys: string[]; skippedUrls: string[] }

const CHUNK = 1000;

export async function cleanupR2Urls(urls: string[]): Promise<R2CleanupResult> {
  const result: R2CleanupResult = { requested: urls.length, deleted: 0, failedKeys: [], skippedUrls: [] };
  const keys: string[] = [];
  for (const url of urls) {
    const key = keyFromPublicUrl(url);
    if (key) keys.push(key); else result.skippedUrls.push(url);
  }
  const uniqueKeys = Array.from(new Set(keys));

  for (let i = 0; i < uniqueKeys.length; i += CHUNK) {
    const batch = uniqueKeys.slice(i, i + CHUNK);
    try {
      const res = await r2Client.send(new DeleteObjectsCommand({
        Bucket: R2_BUCKET,
        Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
      }));
      const failed = (res.Errors || []).map((e) => e.Key).filter((k): k is string => !!k);
      result.failedKeys.push(...failed);
      result.deleted += batch.length - failed.length;
    } catch (e) {
      console.error("R2 tozalash (partiya) xatosi:", e);
      result.failedKeys.push(...batch);
    }
  }
  return result;
}
