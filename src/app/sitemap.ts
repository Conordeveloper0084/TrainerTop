import { MetadataRoute } from "next";

const SITE_URL = "https://trainertop.uz";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Statik sahifalar
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/trainers`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/lessons`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/posts`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
  ];

  // TODO: Supabase'dan dynamic sahifalarni olish
  // Trener profillari, darsliklar — har biri alohida URL
  // const { data: trainers } = await supabase.from('profiles')...
  // const trainerPages = trainers.map(t => ({ url: `${SITE_URL}/trainers/${t.id}`, ... }))

  return [...staticPages];
}
