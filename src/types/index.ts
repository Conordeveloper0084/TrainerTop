// ============================================
// TRAINERTOP — TypeScript Types
// ============================================

// ===== ENUMS =====
export type UserRole = "trainer" | "user";
export type WorkType = "online" | "offline" | "both";
export type Gender = "male" | "female";
export type LessonStatus = "draft" | "published";
export type LessonDifficulty = "beginner" | "intermediate" | "advanced";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

export type Specialization =
  | "fitness"
  | "bodybuilding"
  | "yoga"
  | "powerlifting"
  | "diet"
  | "cardio"
  | "crossfit"
  | "stretching"
  | "pilates"
  | "boxing";

export type UserGoal =
  | "weight_loss"
  | "muscle_gain"
  | "health"
  | "strength"
  | "flexibility"
  | "endurance";

// ===== DATABASE MODELS =====

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface TrainerProfile {
  id: string;
  user_id: string;
  bio: string | null;
  experience_years: number;
  age: number | null;
  gender: Gender | null;
  specializations: Specialization[];
  work_type: WorkType;
  city: string | null;
  gym_name: string | null;
  gym_address: string | null;
  gym_photos: string[];
  location_lat: number | null;
  location_lng: number | null;
  rating: number;
  total_reviews: number;
  total_students: number;
  is_verified: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  age: number | null;
  gender: Gender | null;
  goal: UserGoal | null;
  experience_level: ExperienceLevel | null;
  interests: string[];
  created_at: string;
  updated_at: string;
}

export interface LessonSection {
  title: string;
  body: string;
  image_url?: string;
}

export interface Lesson {
  id: string;
  trainer_id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  price: number;
  category: string | null;
  difficulty: LessonDifficulty;
  content: LessonSection[];
  total_sales: number;
  rating: number;
  total_reviews: number;
  status: LessonStatus;
  created_at: string;
  updated_at: string;
}

export interface Purchase {
  id: string;
  user_id: string;
  lesson_id: string;
  trainer_id: string;
  amount: number;
  commission: number;
  trainer_amount: number;
  payment_method: string;
  payment_id: string | null;
  status: PaymentStatus;
  created_at: string;
}

export interface Post {
  id: string;
  trainer_id: string;
  caption: string | null;
  images: string[];
  is_before_after: boolean;
  likes_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
}

export interface PostLike {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  trainer_id: string;
  user_id: string;
  last_message: string | null;
  last_message_at: string | null;
  trainer_unread: number;
  user_unread: number;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  image_url: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Review {
  id: string;
  trainer_id: string;
  user_id: string;
  lesson_id: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
}

// ===== JOINED TYPES (API javoblari uchun) =====

export interface TrainerWithProfile extends Profile {
  trainer_profile: TrainerProfile;
}

export interface LessonWithTrainer extends Lesson {
  trainer: Profile;
}

export interface PostWithTrainer extends Post {
  trainer: Profile;
  is_liked?: boolean;
}

export interface ConversationWithParticipant extends Conversation {
  trainer: Profile;
  user: Profile;
}

export interface MessageWithSender extends Message {
  sender: Profile;
}

export interface ReviewWithUser extends Review {
  user: Profile;
}

// ===== FILTER / QUERY TYPES =====

export interface TrainerFilters {
  specialization?: Specialization;
  work_type?: WorkType;
  city?: string;
  gender?: Gender;
  min_rating?: number;
  search?: string;
  sort_by?: "rating" | "experience" | "newest";
  page?: number;
  limit?: number;
}

export interface LessonFilters {
  category?: string;
  difficulty?: LessonDifficulty;
  min_price?: number;
  max_price?: number;
  search?: string;
  sort_by?: "rating" | "price_asc" | "price_desc" | "newest" | "popular";
  page?: number;
  limit?: number;
}

// ===== FORM TYPES =====

export interface RegisterFormData {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface TrainerProfileFormData {
  full_name: string;
  avatar_url?: string;
  bio?: string;
  experience_years: number;
  age?: number;
  gender?: Gender;
  specializations: Specialization[];
  work_type: WorkType;
  city?: string;
  gym_name?: string;
  gym_address?: string;
}

export interface LessonFormData {
  title: string;
  description: string;
  cover_image_url?: string;
  price: number;
  category: string;
  difficulty: LessonDifficulty;
  content: LessonSection[];
}

export interface PostFormData {
  caption: string;
  images: File[];
  is_before_after: boolean;
}

// ===== API RESPONSE TYPES =====

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  status: number;
}
