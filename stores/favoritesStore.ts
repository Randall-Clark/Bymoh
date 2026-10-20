import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface FavoritesState {
  favoriteIds: string[];

  /** Ajoute ou retire un favori (toggle) */
  toggleFavorite: (businessId: string) => void;

  /** Définit l'état exact d'un favori (sans toggle) — utilisé pour la sync Supabase */
  setFavorite: (businessId: string, value: boolean) => void;

  /** Remplace toute la liste — synchronise Zustand avec Supabase */
  setAllFavorites: (ids: string[]) => void;

  isFavorite:    (businessId: string) => boolean;
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

      // Déterministe : passe à true ou false sans risque de double-toggle
      setFavorite: (businessId, value) =>
        set((state) => ({
          favoriteIds: value
            ? state.favoriteIds.includes(businessId)
              ? state.favoriteIds
              : [...state.favoriteIds, businessId]
            : state.favoriteIds.filter((id) => id !== businessId),
        })),

      setAllFavorites: (ids) => set({ favoriteIds: ids }),

      isFavorite: (businessId) => get().favoriteIds.includes(businessId),

      clearFavorites: () => set({ favoriteIds: [] }),
    }),
    {
      name:    'favorites-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
