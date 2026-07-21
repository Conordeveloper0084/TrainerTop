import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Shaxsiy va xizmat sahifalari — Google indekslamasin
        disallow: ["/api/", "/admin/", "/profile/", "/chat/", "/ai/"],
      },
    ],
    sitemap: "https://www.trainertop.uz/sitemap.xml",
    host: "https://www.trainertop.uz",
  };
}
