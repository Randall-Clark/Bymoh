import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface FavoritesState {
  favoriteIds: string[];
  toggleFavorite: (businessId: string) => void;
  isFavorite: (businessId: string) => boolean;
  clearFavorites: () => void;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favoriteIds: [],

      toggleFavorite: (businessId) =>
        set((state) => ({
          favoriteIds: state.favoriteIds.includes(businessId)
            ? state.favoriteIds.filter((id) => id !== businessId)
            : [...state.favoriteIds, businessId],
        })),

      isFavorite: (businessId) => get().favoriteIds.includes(businessId),

      clearFavorites: () => set({ favoriteIds: [] }),
    }),
    {
      name: 'bymoh-favorites',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
