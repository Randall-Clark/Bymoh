import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LocationState {
  city: string | null;
  address: string | null;
  lat: number | null;
  lon: number | null;
  setCity: (city: string) => void;
  setAddress: (address: string) => void;
  setCoords: (lat: number, lon: number) => void;
  clearCity: () => void;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      city: null,
      address: null,
      lat: null,
      lon: null,
      setCity: (city) => set({ city }),
      setAddress: (address) => set({ address }),
      setCoords: (lat, lon) => set({ lat, lon }),
      clearCity: () => set({ city: null, address: null, lat: null, lon: null }),
    }),
    {
      name: '@bymoh_location',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ city: state.city, address: state.address, lat: state.lat, lon: state.lon }),
    },
  ),
);