// stores/locationStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LocationState {
  city:    string | null;
  address: string | null;
  label:   string | null;   // ← nom personnalisé affiché à l'utilisateur (ex: "Maison")
  lat:     number | null;
  lon:     number | null;
  userId:  string | null;   // ← lié à l'utilisateur connecté

  setCity:     (city: string) => void;
  setAddress:  (address: string) => void;
  setLabel:    (label: string) => void;
  setCoords:   (lat: number, lon: number) => void;
  setLocation: (city: string, address: string, lat: number, lon: number, userId: string, label?: string) => void;
  clearLocation: () => void;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      city:    null,
      address: null,
      label:   null,
      lat:     null,
      lon:     null,
      userId:  null,

      setCity:    (city)    => set({ city }),
      setAddress: (address) => set({ address }),
      setLabel:   (label)   => set({ label }),
      setCoords:  (lat, lon) => set({ lat, lon }),

      // ✅ Associe la localisation à l'utilisateur connecté
      // label est optionnel — si absent, on conserve l'ancienne valeur
      setLocation: (city, address, lat, lon, userId, label) =>
        set((s) => ({ city, address, lat, lon, userId, label: label ?? s.label })),

      // ✅ Efface tout lors de la déconnexion
      clearLocation: () =>
        set({ city: null, address: null, label: null, lat: null, lon: null, userId: null }),
    }),
    {
      name:    '@bymoh_location',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
