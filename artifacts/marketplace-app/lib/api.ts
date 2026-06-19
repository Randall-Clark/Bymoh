import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const getBaseUrl = (): string => {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/api`;
  if (Platform.OS === "android") return "http://10.0.2.2:5000/api";
  return "http://localhost:5000/api";
};

const TOKEN_KEY = "@kola_token";

export const tokenStore = {
  async get(): Promise<string | null> {
    try { return await AsyncStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  async set(token: string): Promise<void> {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  },
  async clear(): Promise<void> {
    await AsyncStorage.removeItem(TOKEN_KEY);
  },
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await tokenStore.get();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${getBaseUrl()}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string })?.error ?? `Erreur ${res.status}`);
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
