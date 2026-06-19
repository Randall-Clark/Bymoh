import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { User } from "@/constants/types";

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

const USERS_KEY = "@kola_users";
const CURRENT_KEY = "@kola_current_phone";

type UsersMap = Record<string, User>;

async function loadUsers(): Promise<UsersMap> {
  try {
    const raw = await AsyncStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveUsers(map: UsersMap): Promise<void> {
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(map));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const currentPhone = await AsyncStorage.getItem(CURRENT_KEY);
        if (currentPhone) {
          const users = await loadUsers();
          if (users[currentPhone]) setUser(users[currentPhone]);
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const checkPhone = useCallback(async (phone: string): Promise<boolean> => {
    const users = await loadUsers();
    return !!users[phone];
  }, []);

  const registerUser = useCallback(async (
    phone: string,
    name: string,
    email: string,
    pin: string
  ): Promise<void> => {
    const users = await loadUsers();
    const newUser: User = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      phone,
      name,
      email,
      pin,
      role: "client",
      businessIds: [],
      favoriteIds: [],
    };
    users[phone] = newUser;
    await saveUsers(users);
    await AsyncStorage.setItem(CURRENT_KEY, phone);
    setUser(newUser);
  }, []);

  const loginWithPin = useCallback(async (phone: string, pin: string): Promise<boolean> => {
    const users = await loadUsers();
    const found = users[phone];
    if (!found || found.pin !== pin) return false;
    await AsyncStorage.setItem(CURRENT_KEY, phone);
    setUser(found);
    return true;
  }, []);

  const signOut = useCallback(async () => {
    await AsyncStorage.removeItem(CURRENT_KEY);
    setUser(null);
  }, []);

  const updateUser = useCallback(async (updates: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      loadUsers().then((users) => {
        users[updated.phone] = updated;
        saveUsers(users);
      });
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
      loadUsers().then((users) => {
        users[updated.phone] = updated;
        saveUsers(users);
      });
      return updated;
    });
  }, []);

  const addBusiness = useCallback((businessId: string) => {
    setUser((prev) => {
      if (!prev) return prev;
      if (prev.businessIds.includes(businessId)) return prev;
      const updated = { ...prev, businessIds: [...prev.businessIds, businessId], role: "pro" as const };
      loadUsers().then((users) => {
        users[updated.phone] = updated;
        saveUsers(users);
      });
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
