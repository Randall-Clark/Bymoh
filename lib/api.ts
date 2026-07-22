import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Profile } from '@/types';

const TOKEN_KEY = '@bymoh_token';

// URL de base correcte pour l'API REST Supabase
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Base URL pour les appels REST Supabase
function getBaseUrl(): string {
  return `${SUPABASE_URL}/rest/v1`;
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

  // Supabase REST API requiert TOUJOURS ces deux headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,           // ← obligatoire pour Supabase
    'Authorization': token                  // token utilisateur si connecté
      ? `Bearer ${token}`
      : `Bearer ${SUPABASE_ANON_KEY}`,     // sinon anon key par défaut
    ...((options.headers as Record<string, string>) ?? {}),
  };

  const url = `${getBaseUrl()}${path}`;
  console.log('[API] Requête:', options.method ?? 'GET', url);

  const res = await fetch(url, { ...options, headers });

  let data: unknown;
  try { data = await res.json(); } catch { data = {}; }

  if (!res.ok) {
    console.error('[API] Erreur', res.status, data);
    const err = (data as Record<string, unknown>)?.message
      ?? (data as Record<string, unknown>)?.error
      ?? `Erreur ${res.status}`;
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
  delete: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),
};