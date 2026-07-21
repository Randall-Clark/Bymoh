import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LocationState {
  city: string | null;
  setCity: (city: string) => void;
  clearCity: () => void;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      city: null,
      setCity: (city) => set({ city }),
      clearCity: () => set({ city: null }),
    }),
    {
      name: '@bymoh_location',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ city: state.city }),
    },
  ),
);
