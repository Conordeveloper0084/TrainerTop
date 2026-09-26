import { S3Client } from "@aws-sdk/client-s3";

// Cloudflare R2 — S3-compatible storage
export const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  forcePathStyle: true, // MUHIM — R2 path-style URL kerak
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  // MUHIM: yangi AWS SDK sukut bo'yicha CRC32 checksum qo'shadi. Presigned URL'da bu
  // "bo'sh tana" checksum'i bo'lib qoladi va R2 haqiqiy videoni rad etadi (BadDigest).
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

export const R2_BUCKET = process.env.R2_BUCKET_NAME || "trainertop-media";
export const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || "").replace(/\/+$/, "");
