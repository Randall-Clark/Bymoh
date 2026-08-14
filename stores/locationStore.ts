// stores/locationStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LocationState {
  city:    string | null;
  address: string | null;
  lat:     number | null;
  lon:     number | null;
  userId:  string | null;   // ← lié à l'utilisateur connecté

  setCity:     (city: string) => void;
  setAddress:  (address: string) => void;
  setCoords:   (lat: number, lon: number) => void;
  setLocation: (city: string, address: string, lat: number, lon: number, userId: string) => void;
  clearLocation: () => void;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      city:    null,
      address: null,
      lat:     null,
      lon:     null,
      userId:  null,

      setCity:    (city)    => set({ city }),
      setAddress: (address) => set({ address }),
      setCoords:  (lat, lon) => set({ lat, lon }),

      // ✅ Associe la localisation à l'utilisateur connecté
      setLocation: (city, address, lat, lon, userId) =>
        set({ city, address, lat, lon, userId }),

      // ✅ Efface tout lors de la déconnexion
      clearLocation: () =>
        set({ city: null, address: null, lat: null, lon: null, userId: null }),
    }),
    {
      name:    '@bymoh_location',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
