import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/** Send OTP code to phone number (E.164 format: +22890000000) */
export async function sendOTP(phone: string) {
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) throw error;
}

/** Verify OTP token received via SMS */
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
 * Check whether a phone number already has an account in the users table.
 * Returns the user id if found, null otherwise.
 */
export async function checkPhoneExists(phone: string): Promise<string | null> {
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('phone', phone)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Set the user's PIN by updating the Supabase Auth password AND
 * marking pin_hash in the users table so the AuthGuard knows PIN is configured.
 * Must be called while a valid session is active (right after OTP / complete-profile).
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
 * Sign in a returning user with their phone + PIN.
 * Uses Supabase's built-in signInWithPassword (phone provider).
 */
export async function signInWithPIN(phone: string, pin: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ phone, password: pin });
  if (error) throw error;
  return data;
}

/** Get currently authenticated Supabase user */
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/** Sign out from Supabase */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Get public URL for a file stored in Supabase Storage */
export function getStorageUrl(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
