import { NextRequest, NextResponse } from "next/server";
import { UploadPartCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET } from "@/lib/r2";
import { getApiUser } from "@/lib/supabase/api-auth";
import { keyBelongsToUser } from "@/lib/media";

// POST /api/upload/part — bitta chunk yuklash (ESKI yo'l; yangi klientlar presigned URL ishlatadi)
export async function POST(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const formData = await request.formData();
    const chunk = formData.get("chunk") as File;
    const uploadId = formData.get("uploadId") as string;
    const key = formData.get("key") as string;
    const partNumber = parseInt(formData.get("partNumber") as string);

    if (!chunk || !uploadId || !key || !partNumber || partNumber < 1 || partNumber > 10000) {
      return NextResponse.json({ message: "chunk, uploadId, key, partNumber kerak" }, { status: 400 });
    }
    if (!keyBelongsToUser(key, user.id)) {
      return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    }

    const buffer = Buffer.from(await chunk.arrayBuffer());

    const { ETag } = await r2Client.send(
      new UploadPartCommand({
        Bucket: R2_BUCKET,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: buffer,
      })
    );

    return NextResponse.json({ etag: ETag, partNumber });
  } catch (error: any) {
    console.error("Part upload error:", error);
    return NextResponse.json({ message: "Bo'lakni yuklashda xatolik" }, { status: 500 });
  }
}
