// Trener ma'lumotlarining OMMAVIY (login'siz ko'rinadigan) qismi.
// Ro'yxatda yo'q maydon (card_number, card_holder, balance, total_earned, ...) hech qachon
// ommaviy API javobiga tushmaydi — yangi maxfiy ustun qo'shilsa ham.
export const TRAINER_PUBLIC_FIELDS = [
  "id", "user_id", "bio", "experience_years", "age", "gender", "specializations", "work_type",
  "city", "gym_name", "gym_address", "gym_photos", "location_lat", "location_lng",
  "rating", "total_reviews", "total_students", "is_verified", "is_published",
  "followers_count", "monthly_price", "consultation_price", "featured_blurb", "created_at", "updated_at",
] as const;

export function pickFields<T extends Record<string, any>>(row: T | null | undefined, fields: readonly string[]): Record<string, any> | null {
  if (!row) return null;
  const out: Record<string, any> = {};
  for (const f of fields) if (f in row) out[f] = row[f];
  return out;
}

export function publicTrainer(row: Record<string, any> | null | undefined, profileFields: readonly string[] = ["id", "full_name", "avatar_url"]) {
  if (!row) return null;
  const base = pickFields(row, TRAINER_PUBLIC_FIELDS) as Record<string, any>;
  if (row.profiles) base.profiles = pickFields(row.profiles, profileFields);
  return base;
}
