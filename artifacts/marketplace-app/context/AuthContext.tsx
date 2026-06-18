import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { User } from "@/constants/types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (phone: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  toggleFavorite: (businessId: string) => void;
  addBusiness: (businessId: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "@lokali_user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setUser(JSON.parse(raw));
      })
      .finally(() => setIsLoading(false));
  }, []);

  const persist = useCallback(async (u: User | null) => {
    if (u) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    else await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const signIn = useCallback(async (phone: string, name: string) => {
    const newUser: User = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      phone,
      name,
      role: "client",
      businessIds: [],
      favoriteIds: [],
    };
    setUser(newUser);
    await persist(newUser);
  }, [persist]);

  const signOut = useCallback(async () => {
    setUser(null);
    await persist(null);
  }, [persist]);

  const updateUser = useCallback(async (updates: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      persist(updated);
      return updated;
    });
  }, [persist]);

  const toggleFavorite = useCallback((businessId: string) => {
    setUser((prev) => {
      if (!prev) return prev;
      const favs = prev.favoriteIds.includes(businessId)
        ? prev.favoriteIds.filter((id) => id !== businessId)
        : [...prev.favoriteIds, businessId];
      const updated = { ...prev, favoriteIds: favs };
      persist(updated);
      return updated;
    });
  }, [persist]);

  const addBusiness = useCallback((businessId: string) => {
    setUser((prev) => {
      if (!prev) return prev;
      if (prev.businessIds.includes(businessId)) return prev;
      const updated = { ...prev, businessIds: [...prev.businessIds, businessId], role: "pro" as const };
      persist(updated);
      return updated;
    });
  }, [persist]);

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, signIn, signOut, updateUser, toggleFavorite, addBusiness }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
