// components/WarningBanner.tsx
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useLocationStore } from '@/stores/locationStore';
import { COUNTRIES } from '@/lib/countries';

async function getCountryCode(lat: number, lon: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=3`;
    const res  = await fetch(url, {
      headers: { 'User-Agent': 'BymohApp/1.0', 'Accept-Language': 'en' },
    });
    const data = await res.json();
    return (data?.address?.country_code ?? '').toUpperCase() || null;
  } catch {
    return null;
  }
}

export function CountryMismatchWarning() {
  const { profile }       = useAuthStore();
  const locationStore     = useLocationStore();
  const [mismatch, setMismatch] = useState(false);
  const lastCheck = useRef<string>('');

  // Récupère lat/lon depuis le store (différentes clés possibles selon la version)
  const lat = (locationStore as any).lat ?? (locationStore as any).latitude  ?? null;
  const lon = (locationStore as any).lon ?? (locationStore as any).longitude ?? null;

  useEffect(() => {
    const residenceCode = (profile as any)?.country_code;
    if (!residenceCode || !lat || !lon) { setMismatch(false); return; }

    // Évite de re-vérifier si les coordonnées n'ont pas changé
    const key = `${lat},${lon}`;
    if (key === lastCheck.current) return;
    lastCheck.current = key;

    let cancelled = false;
    getCountryCode(lat, lon).then((detected) => {
      if (cancelled) return;
      if (!detected) {
        // Si la détection échoue → pas de warning (bénéfice du doute)
        setMismatch(false);
        return;
      }
      setMismatch(detected !== residenceCode);
    });
    return () => { cancelled = true; };
  }, [lat, lon, profile]);

  if (!mismatch) return null;

  const country = COUNTRIES.find((c) => c.code === (profile as any)?.country_code);

  return (
    <TouchableOpacity
      style={styles.banner}
      onPress={() => router.push('/(client)/profile/help' as any)}
      activeOpacity={0.9}
    >
      <View style={styles.iconWrap}>
        <Feather name="alert-triangle" size={16} color="#D97706" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Adresse hors de votre pays</Text>
        <Text style={styles.subtitle}>
          Votre adresse ne correspond pas à votre pays de résidence ({country?.name}).
          Des frais supplémentaires peuvent s'appliquer.
        </Text>
      </View>
      <View style={styles.moreBtn}>
        <Text style={styles.moreText}>En savoir +</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#FFFBEB', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#FDE68A', marginHorizontal: 20, marginBottom: 8 },
  iconWrap: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  title:    { fontSize: 13, fontWeight: '700', color: '#92400E' },
  subtitle: { fontSize: 12, color: '#B45309', lineHeight: 17, marginTop: 2 },
  moreBtn:  { backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginTop: 2 },
  moreText: { fontSize: 10, fontWeight: '700', color: '#D97706' },
});
