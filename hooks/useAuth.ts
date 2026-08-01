import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { api, getApiToken, removeApiToken, normalizeProfile } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useLocationStore } from '@/stores/locationStore'; // ← ajout
import type { Profile } from '@/types';

export function useAuth() {
  const {
    token, session, profile, isLoading,
    setToken, setSession, setProfile, setLoading, clearAuth,
  } = useAuthStore();

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);

      // 1. Try Express API token
      const savedToken = await getApiToken();
      if (savedToken) {
        try {
          const data = await api.get<Record<string, unknown>>('/users/me');
          if (!cancelled) {
            setToken(savedToken);
            setProfile(normalizeProfile(data));
            setLoading(false);
            return;
          }
        } catch {
          await removeApiToken();
          if (!cancelled) setToken(null);
        }
      }

      // 2. Fall back to Supabase session
      const { data: { session: s } } = await supabase.auth.getSession();
      if (!cancelled) {
        setSession(s);
        if (s?.user) {
          setLoading(true);
          const p = await fetchSupabaseProfile(s.user.id);
          if (!cancelled) {
            setProfile(p);
            // ← Charge l'adresse de livraison sauvegardée
            loadDeliveryAddress(p);
          }
        }
        setLoading(false);
      }
    }

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, s) => {
      if (cancelled) return;
      setSession(s);
      if (s?.user) {
        setLoading(true);
        const p = await fetchSupabaseProfile(s.user.id);
        if (!cancelled) {
          setProfile(p);
          // ← Charge l'adresse de livraison sauvegardée
          loadDeliveryAddress(p);
        }
      } else {
        const t = await getApiToken();
        if (!t) setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await removeApiToken();
    await supabase.auth.signOut();
    clearAuth();
    // Efface aussi l'adresse au logout
    useLocationStore.getState().clearCity();
  };

  return {
    token,
    session,
    profile,
    isLoading,
    isAuthenticated: !!token || !!session,
    hasProfile: !!profile,
    signOut,
  };
}

async function fetchSupabaseProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data as unknown as Profile;
}

// ── Charge l'adresse de livraison dans le locationStore ──────────────────────
function loadDeliveryAddress(profile: Profile | null) {
  if (!profile) return;
  const p = profile as any;
  if (p.delivery_city)   useLocationStore.getState().setCity(p.delivery_city);
  if (p.delivery_address) useLocationStore.getState().setAddress(p.delivery_address);
  if (p.delivery_lat && p.delivery_lon) {
    useLocationStore.getState().setCoords(p.delivery_lat, p.delivery_lon);
  }
}