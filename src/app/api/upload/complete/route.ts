import { NextRequest, NextResponse } from "next/server";
import { CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from "@/lib/r2";
import { getApiUser } from "@/lib/supabase/api-auth";
import { keyBelongsToUser } from "@/lib/media";

// POST /api/upload/complete — multipart upload tugatish
export async function POST(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const { uploadId, key, parts } = await request.json();

    if (!uploadId || !key || !Array.isArray(parts) || parts.length === 0) {
      return NextResponse.json({ message: "uploadId, key, parts kerak" }, { status: 400 });
    }
    if (!keyBelongsToUser(key, user.id)) {
      return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    }

    const sorted = [...parts]
      .map((p: any) => ({ PartNumber: Number(p.partNumber), ETag: String(p.etag) }))
      .sort((a, b) => a.PartNumber - b.PartNumber);

    await r2Client.send(
      new CompleteMultipartUploadCommand({
        Bucket: R2_BUCKET,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: sorted },
      })
    );

    return NextResponse.json({ success: true, url: `${R2_PUBLIC_URL}/${key}` });
  } catch (error: any) {
    console.error("Complete error:", error);
    return NextResponse.json({ message: "Yuklashni yakunlashda xatolik" }, { status: 500 });
  }
}
