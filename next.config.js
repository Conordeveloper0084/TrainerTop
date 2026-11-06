// R2 ommaviy domeni (R2_PUBLIC_URL) va ko'chirish davridagi eski domenlar (R2_LEGACY_PUBLIC_URLS)
// next/image uchun avtomatik ruxsat etiladi — domen almashtirilganda bu faylni qo'lda tahrirlash shart emas.
const r2MediaHosts = [process.env.R2_PUBLIC_URL, ...(process.env.R2_LEGACY_PUBLIC_URLS || "").split(",")]
  .map((u) => (u || "").trim())
  .filter(Boolean)
  .map((u) => { try { return new URL(u).hostname; } catch { return null; } })
  .filter(Boolean);

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "*.r2.dev",
      },
      {
        protocol: "https",
        hostname: "*.cloudflarestorage.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      ...Array.from(new Set(r2MediaHosts)).map((hostname) => ({ protocol: "https", hostname })),
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
