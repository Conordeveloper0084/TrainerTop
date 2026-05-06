import { NextRequest, NextResponse } from "next/server";
import { CreateMultipartUploadCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from "@/lib/r2";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// POST /api/upload/init — multipart upload boshlash
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const { fileName, fileType, folder } = await request.json();
    if (!fileName || !fileType) return NextResponse.json({ message: "fileName va fileType kerak" }, { status: 400 });

    const ext = fileName.split(".").pop()?.toLowerCase() || "mp4";
    const prefix = fileType.startsWith("video/") ? "video" : "img";
    const bucketFolder = folder || "uploads";
    const key = `${bucketFolder}/${user.id}/${prefix}-${Date.now()}.${ext}`;

    const command = new CreateMultipartUploadCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: fileType,
      CacheControl: "public, max-age=31536000",
    });

    const { UploadId } = await r2Client.send(command);

    return NextResponse.json({
      uploadId: UploadId,
      key,
      publicUrl: `${R2_PUBLIC_URL}/${key}`,
    });
  } catch (error: any) {
    console.error("Init error:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
