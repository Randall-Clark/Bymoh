import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '@/types';

interface AuthState {
  token: string | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  setToken: (token: string | null) => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setLoading: (isLoading: boolean) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      session: null,
      profile: null,
      isLoading: true,
      setToken: (token) => set({ token }),
      setSession: (session) => set({ session }),
      setProfile: (profile) => set({ profile }),
      setLoading: (isLoading) => set({ isLoading }),
      clearAuth: () => set({ token: null, session: null, profile: null }),
    }),
    {
      name: 'bymoh-auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ token: state.token, session: state.session, profile: state.profile }),
    },
  ),
);
