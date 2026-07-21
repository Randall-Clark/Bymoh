import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Profile } from '@/types';

const TOKEN_KEY = '@bymoh_token';

function getBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }
  if (process.env.EXPO_PUBLIC_DOMAIN) {
    return `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
  }
  return 'http://localhost:5000/api';
}

export async function getApiToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function saveApiToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function removeApiToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export function normalizeProfile(data: Record<string, unknown>): Profile {
  return {
    id: data.id as string,
    phone: data.phone as string,
    name: data.name as string,
    email: (data.email ?? undefined) as string | undefined,
    role: data.role as 'client' | 'pro' | 'admin',
    avatar_url: ((data.avatarUrl ?? data.avatar_url) ?? undefined) as string | undefined,
    is_active: Boolean(data.isActive ?? data.is_active ?? true),
    pin_hash: 'configured',
    created_at: ((data.createdAt ?? data.created_at) ?? '') as string,
    updated_at: ((data.updatedAt ?? data.updated_at) ?? undefined) as string | undefined,
  };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getApiToken();
  const res = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((options.headers as Record<string, string>) ?? {}),
    },
  });
  let data: unknown;
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) {
    const err = (data as Record<string, unknown>)?.error;
    throw new Error(typeof err === 'string' ? err : `Erreur ${res.status}`);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
};
