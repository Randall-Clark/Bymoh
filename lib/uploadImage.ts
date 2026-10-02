// lib/uploadImage.ts
// Approche officielle Supabase pour React Native
// https://supabase.com/docs/guides/storage/uploads/standard-uploads#react-native
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';

export async function uploadImageToSupabase(
  uri: string,
  bucket: string,
  path: string,
): Promise<string | null> {
  try {
    const rawExt = uri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
    const contentType = `image/${rawExt === 'jpg' ? 'jpeg' : rawExt}`;

    // 1. Lire l'image en base64
    const base64 = await readAsStringAsync(uri, {
      encoding: EncodingType.Base64,
    });

    // 2. Décoder en ArrayBuffer (base64-arraybuffer)
    const arrayBuffer = decode(base64);

    // 3. Upload via Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, arrayBuffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      console.warn('[upload] error:', error.message);
      return null;
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
    return `${urlData.publicUrl}?t=${Date.now()}`;
  } catch (e) {
    console.warn('[upload] exception:', e);
    return null;
  }
}
