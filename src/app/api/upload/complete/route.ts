import { NextRequest, NextResponse } from "next/server";
import { CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET } from "@/lib/r2";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// POST /api/upload/complete — multipart upload tugatish
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const { uploadId, key, parts } = await request.json();

    if (!uploadId || !key || !parts?.length) {
      return NextResponse.json({ message: "uploadId, key, parts kerak" }, { status: 400 });
    }

    const command = new CompleteMultipartUploadCommand({
      Bucket: R2_BUCKET,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.map((p: any) => ({
          PartNumber: p.partNumber,
          ETag: p.etag,
        })),
      },
    });

    await r2Client.send(command);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Complete error:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
