import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Statistika 5 daqiqada bir yangilanadi (aks holda build paytidagi qiymat qotib qoladi)
export const revalidate = 300;

// GET /api/landing-stats — bosh sahifa statistika
export async function GET() {
  try {
    const [trainersRes, lessonsRes, ratingRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).eq("role", "trainer"),
      supabaseAdmin.from("lessons").select("*", { count: "exact", head: true }).eq("status", "published"), // qoralama va olib tashlangan darsliklar sanalmaydi
      supabaseAdmin.from("trainer_profiles").select("rating").gt("rating", 0),
    ]);

    const ratings = ratingRes.data || [];
    const avgRating = ratings.length > 0
      ? ratings.reduce((s: number, t: any) => s + (t.rating || 0), 0) / ratings.length
      : 0;

    return NextResponse.json({
      trainers: trainersRes.count || 0,
      lessons: lessonsRes.count || 0,
      rating: avgRating,
    });
  } catch (error: any) {
    return NextResponse.json({ trainers: 0, lessons: 0, rating: 0 });
  }
}
