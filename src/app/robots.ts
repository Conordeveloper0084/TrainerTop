import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/profile/", "/chat/", "/ai/"],
      },
    ],
    sitemap: "https://trainertop.uz/sitemap.xml",
  };
}
