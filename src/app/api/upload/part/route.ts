import { NextRequest, NextResponse } from "next/server";
import { UploadPartCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET } from "@/lib/r2";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// POST /api/upload/part — bitta chunk yuklash
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const formData = await request.formData();
    const chunk = formData.get("chunk") as File;
    const uploadId = formData.get("uploadId") as string;
    const key = formData.get("key") as string;
    const partNumber = parseInt(formData.get("partNumber") as string);

    if (!chunk || !uploadId || !key || !partNumber) {
      return NextResponse.json({ message: "chunk, uploadId, key, partNumber kerak" }, { status: 400 });
    }

    const arrayBuffer = await chunk.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const command = new UploadPartCommand({
      Bucket: R2_BUCKET,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: buffer,
    });

    const { ETag } = await r2Client.send(command);

    return NextResponse.json({ etag: ETag, partNumber });
  } catch (error: any) {
    console.error("Part upload error:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
