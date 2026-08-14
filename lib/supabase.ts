import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = process.env.EXPO_PUBLIC_SUPABASE_URL     ?? 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage:            AsyncStorage,
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: false,
  },
  // ✅ Pas de fetch custom — évite les problèmes AbortSignal sur React Native
});

/**
 * Envoie un OTP via l'Edge Function send-otp (avec cooldown 60s côté serveur).
 */
export async function sendOTP(phone: string) {
  const { data, error } = await supabase.functions.invoke('send-otp', {
    body: { phone },
  });

  if (error) throw new Error(error.message ?? 'Erreur Edge Function');
  if (data?.error) {
    const err = new Error(data.error) as any;
    err.cooldown = data.cooldown;
    throw err;
  }

  return data;
}

/**
 * Vérifie le code OTP reçu par SMS.
 */
export async function verifyOTP(phone: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  });
  if (error) throw error;
  return data;
}

/**
 * Vérifie si un numéro est déjà enregistré via RPC SECURITY DEFINER.
 */
export async function checkPhoneExists(phone: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_phone_registered', {
    p_phone: phone,
  });
  if (error) throw error;
  return data === true;
}

/**
 * Connexion avec téléphone + NIP.
 */
export async function signInWithPIN(phone: string, pin: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    phone,
    password: pin,
  });
  if (error) throw error;
  return data;
}

/**
 * Définit ou met à jour le NIP.
 */
export async function setPIN(userId: string, pin: string) {
  const { error: authError } = await supabase.auth.updateUser({ password: pin });
  if (authError) throw authError;

  const { error: dbError } = await supabase
    .from('users')
    .update({ pin_hash: 'configured', updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (dbError) throw dbError;
}

/**
 * Retourne l'utilisateur Supabase Auth actuellement connecté.
 */
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Déconnecte l'utilisateur.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Retourne l'URL publique d'un fichier dans Supabase Storage.
 */
export function getStorageUrl(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
