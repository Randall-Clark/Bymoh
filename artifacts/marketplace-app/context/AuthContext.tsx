import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { User } from "@/constants/types";
import { api, tokenStore } from "@/lib/api";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  checkPhone: (phone: string) => Promise<boolean>;
  registerUser: (phone: string, name: string, email: string, pin: string) => Promise<void>;
  loginWithPin: (phone: string, pin: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  toggleFavorite: (businessId: string) => void;
  addBusiness: (businessId: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_KEY = "@kola_user";
const FAV_KEY = "@kola_favs";
const BIZ_KEY = "@kola_biz";

async function loadLocal<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

function buildUser(base: Record<string, unknown>, favoriteIds: string[], businessIds: string[]): User {
  return {
    id: base.id as string,
    phone: base.phone as string,
    name: base.name as string,
    email: base.email as string | undefined,
    role: (base.role as User["role"]) ?? "client",
    avatar: base.avatarUrl as string | undefined,
    businessIds,
    favoriteIds,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await tokenStore.get();
        if (token) {
          try {
            const apiUser = await api.get<Record<string, unknown>>("/users/me");
            const favs = await loadLocal<string[]>(FAV_KEY, []);
            const biz = await loadLocal<string[]>(BIZ_KEY, []);
            const u = buildUser(apiUser, favs, biz);
            setUser(u);
            await AsyncStorage.setItem(USER_KEY, JSON.stringify(u));
          } catch {
            const cached = await loadLocal<User | null>(USER_KEY, null);
            if (cached) setUser(cached);
            else await tokenStore.clear();
          }
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const checkPhone = useCallback(async (phone: string): Promise<boolean> => {
    try {
      const { exists } = await api.post<{ exists: boolean }>("/auth/check-phone", { phone });
      return exists;
    } catch { return false; }
  }, []);

  const registerUser = useCallback(async (
    phone: string, name: string, email: string, pin: string,
  ): Promise<void> => {
    try {
      const { user: apiUser, token } = await api.post<{ user: Record<string, unknown>; token: string }>(
        "/auth/register", { phone, name, email, pin },
      );
      await tokenStore.set(token);
      const u = buildUser(apiUser, [], []);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(u));
      setUser(u);
    } catch {
      const localUser: User = {
        id: `local_${Date.now()}`,
        phone,
        name,
        email,
        role: "client",
        businessIds: [],
        favoriteIds: [],
      };
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(localUser));
      setUser(localUser);
    }
  }, []);

  const loginWithPin = useCallback(async (phone: string, pin: string): Promise<boolean> => {
    try {
      const { user: apiUser, token } = await api.post<{ user: Record<string, unknown>; token: string }>(
        "/auth/login", { phone, pin },
      );
      await tokenStore.set(token);
      const favs = await loadLocal<string[]>(FAV_KEY, []);
      const biz = await loadLocal<string[]>(BIZ_KEY, []);
      const u = buildUser(apiUser, favs, biz);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(u));
      setUser(u);
      return true;
    } catch { return false; }
  }, []);

  const signOut = useCallback(async () => {
    await tokenStore.clear();
    await AsyncStorage.multiRemove([USER_KEY, FAV_KEY, BIZ_KEY]);
    setUser(null);
  }, []);

  const updateUser = useCallback(async (updates: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      AsyncStorage.setItem(USER_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const toggleFavorite = useCallback((businessId: string) => {
    setUser((prev) => {
      if (!prev) return prev;
      const favs = prev.favoriteIds.includes(businessId)
        ? prev.favoriteIds.filter((id) => id !== businessId)
        : [...prev.favoriteIds, businessId];
      const updated = { ...prev, favoriteIds: favs };
      AsyncStorage.setItem(FAV_KEY, JSON.stringify(favs));
      AsyncStorage.setItem(USER_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const addBusiness = useCallback((businessId: string) => {
    setUser((prev) => {
      if (!prev) return prev;
      if (prev.businessIds.includes(businessId)) return prev;
      const biz = [...prev.businessIds, businessId];
      const updated = { ...prev, businessIds: biz, role: "pro" as const };
      AsyncStorage.setItem(BIZ_KEY, JSON.stringify(biz));
      AsyncStorage.setItem(USER_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{
      user, isLoading, isAuthenticated: !!user,
      checkPhone, registerUser, loginWithPin,
      signOut, updateUser, toggleFavorite, addBusiness,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
