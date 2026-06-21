import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface SavedAddress {
  label: string;
  quartier?: string;
  city: string;
  coords?: { lat: number; lng: number };
  isGPS?: boolean;
}

interface LocationContextValue {
  address: SavedAddress | null;
  isLoadingGPS: boolean;
  saveAddress: (addr: SavedAddress) => Promise<void>;
  requestGPS: () => Promise<"granted" | "denied" | "error">;
  clearAddress: () => Promise<void>;
}

const LocationContext = createContext<LocationContextValue | null>(null);

const ADDR_KEY = "@kola_address";

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddressState] = useState<SavedAddress | null>(null);
  const [isLoadingGPS, setIsLoadingGPS] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ADDR_KEY).then((raw) => {
      if (raw) {
        try { setAddressState(JSON.parse(raw)); } catch { /* ignore */ }
      }
    });
  }, []);

  const saveAddress = useCallback(async (addr: SavedAddress) => {
    setAddressState(addr);
    await AsyncStorage.setItem(ADDR_KEY, JSON.stringify(addr));
  }, []);

  const clearAddress = useCallback(async () => {
    setAddressState(null);
    await AsyncStorage.removeItem(ADDR_KEY);
  }, []);

  const requestGPS = useCallback(async (): Promise<"granted" | "denied" | "error"> => {
    setIsLoadingGPS(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setIsLoadingGPS(false);
        return "denied";
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const [geo] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });

      if (geo) {
        const city = geo.city || geo.subregion || geo.region || "Ville inconnue";
        const rawQuartier = geo.district || geo.street || undefined;
        const quartier = rawQuartier && rawQuartier !== city ? rawQuartier : undefined;
        const label = quartier ? `${quartier}, ${city}` : city;

        await saveAddress({
          label,
          quartier,
          city,
          coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          isGPS: true,
        });
      }

      return "granted";
    } catch {
      return "error";
    } finally {
      setIsLoadingGPS(false);
    }
  }, [saveAddress]);

  return (
    <LocationContext.Provider value={{ address, isLoadingGPS, saveAddress, requestGPS, clearAddress }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used within LocationProvider");
  return ctx;
}
