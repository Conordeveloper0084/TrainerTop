// Darslik videosini R2'ga yuklash — MIJOZ TOMONI. Katta fayllar uchun presigned-URL multipart
// yo'li ishlatiladi: server faqat /api/upload/init orqali har bir bo'lak uchun QISQA MUDDATLI
// havola (presigned URL) beradi, bo'lakning o'zi esa TO'G'RIDAN-TO'G'RI brauzerdan R2'ga PUT
// qilinadi (Vercel serverless funksiyasi orqali O'TMAYDI — shuning uchun Vercel'ning so'rov
// hajmi chegarasiga (4.5MB) va R2'ning "oxirgisidan boshqa har bir bo'lak >= 5MiB" talabiga
// (server partSize=8MB beradi) ikkalasiga ham mos keladi).
//
// ESKI yo'l (bo'laklarni /api/upload/part orqali serverga yuborib, undan R2'ga) endi
// ISHLATILMAYDI — u 3.5MB'lik bo'laklar bilan ishlagani uchun R2'ning 5MiB minimal bo'lak
// talabini buzib, CompleteMultipartUpload bosqichida "Upload tugatilmadi" xatosi bilan
// DOIM yiqilib tushardi (fayl 3.5MB'dan katta bo'lsa — deyarli har doim).
const SIMPLE_UPLOAD_MAX = 4 * 1024 * 1024;   // shundan kichik fayllar — bitta so'rovda, oddiy /api/upload

export interface UploadProgress { uploadedBytes: number; totalBytes: number; part?: number; totalParts?: number }
export type ProgressCb = (p: UploadProgress) => void;

async function readJsonError(res: Response, fallback: string): Promise<string> {
  try { const d = await res.json(); return d?.message || fallback; } catch { return fallback; }
}

export async function uploadLessonVideo(file: File, folder: "lessons" | "posts" | "chat" = "lessons", onProgress?: ProgressCb): Promise<string> {
  if (file.size <= SIMPLE_UPLOAD_MAX) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("bucket", folder);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (!res.ok) throw new Error(await readJsonError(res, "Yuklashda xatolik"));
    const data = await res.json();
    onProgress?.({ uploadedBytes: file.size, totalBytes: file.size });
    return data.url || data.publicUrl;
  }

  const initRes = await fetch("/api/upload/init", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, fileType: file.type, folder, size: file.size }),
  });
  if (!initRes.ok) throw new Error(await readJsonError(initRes, "Yuklashni boshlab bo'lmadi"));
  const { uploadId, key, publicUrl, parts: partUrls, partSize } = await initRes.json();
  if (!Array.isArray(partUrls) || !partSize) throw new Error("Server noto'g'ri javob qaytardi (presigned URL yo'q)");

  const parts: { partNumber: number; etag: string }[] = [];
  let uploadedBytes = 0;

  for (const { partNumber, url } of partUrls as { partNumber: number; url: string }[]) {
    const start = (partNumber - 1) * partSize;
    const end = Math.min(start + partSize, file.size);
    const chunk = file.slice(start, end);

    const putRes = await fetch(url, { method: "PUT", body: chunk });
    if (!putRes.ok) throw new Error(`Bo'lak ${partNumber}/${partUrls.length} yuklanmadi (R2 xatosi)`);
    const etag = putRes.headers.get("ETag");
    if (!etag) throw new Error(`Bo'lak ${partNumber}/${partUrls.length}: ETag topilmadi (R2 CORS "ExposeHeaders: ETag" sozlanganini tekshiring)`);
    parts.push({ partNumber, etag });

    uploadedBytes += chunk.size;
    onProgress?.({ uploadedBytes, totalBytes: file.size, part: partNumber, totalParts: partUrls.length });
  }

  const completeRes = await fetch("/api/upload/complete", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadId, key, parts }),
  });
  if (!completeRes.ok) throw new Error(await readJsonError(completeRes, "Yuklashni yakunlab bo'lmadi"));

  return publicUrl;
}
