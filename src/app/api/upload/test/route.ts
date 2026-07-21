import { NextResponse } from "next/server";
import { PutObjectCommand, ListBucketsCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from "@/lib/r2";

// GET /api/upload/test — R2 ulanishni tekshirish
export async function GET() {
  const checks: any = {
    env: {
      R2_ENDPOINT: !!process.env.R2_ENDPOINT,
      R2_ACCESS_KEY_ID: !!process.env.R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY: !!process.env.R2_SECRET_ACCESS_KEY,
      R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || "NOT SET",
      R2_PUBLIC_URL: process.env.R2_PUBLIC_URL || "NOT SET",
    },
    r2Connection: "testing...",
    presignedUrl: "testing...",
  };

  // R2 ulanish test
  try {
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: "test/connection-test.txt",
      ContentType: "text/plain",
    });
    const url = await getSignedUrl(r2Client, command, { expiresIn: 60 });
    checks.r2Connection = "OK";
    checks.presignedUrl = url.substring(0, 100) + "...";
    checks.presignedUrlDomain = new URL(url).hostname;
  } catch (error: any) {
    checks.r2Connection = "FAILED: " + error.message;
    checks.presignedUrl = "FAILED";
  }

  return NextResponse.json(checks, { status: 200 });
}
