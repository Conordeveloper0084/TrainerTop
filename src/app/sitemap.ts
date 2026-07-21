import { MetadataRoute } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";

const SITE_URL = "https://www.trainertop.uz";

// Har 1 soatda yangilanadi (Google yangi sahifalarni ko'radi)
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Statik sahifalar
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/trainers`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/lessons`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/posts`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/register`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/login`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];

  const dynamicPages: MetadataRoute.Sitemap = [];

  // Trener profillari — har biri alohida sahifa (SEO uchun muhim)
  try {
    const { data: trainers } = await supabaseAdmin
      .from("trainer_profiles")
      .select("user_id")
      .limit(1000);
    if (trainers) {
      for (const t of trainers) {
        dynamicPages.push({
          url: `${SITE_URL}/trainers/${t.user_id}`,
          lastModified: new Date(),
          changeFrequency: "weekly",
          priority: 0.8,
        });
      }
    }
  } catch (e) {
    // Xato bo'lsa ham sitemap statik sahifalar bilan ishlaydi
  }

  // Darsliklar — faqat e'lon qilinganlari
  try {
    const { data: lessons } = await supabaseAdmin
      .from("lessons")
      .select("id")
      .eq("status", "published")
      .limit(1000);
    if (lessons) {
      for (const l of lessons) {
        dynamicPages.push({
          url: `${SITE_URL}/lessons/${l.id}`,
          lastModified: new Date(),
          changeFrequency: "weekly",
          priority: 0.7,
        });
      }
    }
  } catch (e) {
    // Xato bo'lsa ham sitemap ishlaydi
  }

  return [...staticPages, ...dynamicPages];
}
