import { create } from "zustand";
import type { Profile, TrainerProfile, UserProfile } from "@/types";

interface AuthState {
  user: Profile | null;
  trainerProfile: TrainerProfile | null;
  userProfile: UserProfile | null;
  ready: boolean; // isLoading o'rniga "ready" — aniqroq

  setUser: (user: Profile | null) => void;
  setTrainerProfile: (profile: TrainerProfile | null) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  setReady: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  trainerProfile: null,
  userProfile: null,
  ready: false,

  setUser: (user) => set({ user }),
  setTrainerProfile: (trainerProfile) => set({ trainerProfile }),
  setUserProfile: (userProfile) => set({ userProfile }),
  setReady: () => set({ ready: true }),
  logout: () => set({ user: null, trainerProfile: null, userProfile: null }),
}));
