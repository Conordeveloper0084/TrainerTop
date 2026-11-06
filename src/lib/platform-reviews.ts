// Butun platformaga baho (5 yulduz + izoh) — brauzerda ham, serverda ham
export const PLATFORM_COMMENT_MAX = 500;
export interface PlatformReviewStats { count: number; average: number | null; distribution: Record<string, number> }
export interface FeaturedReview { name: string; avatar_url: string | null; rating: number; comment: string; created_at: string }
