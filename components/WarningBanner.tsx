// components/WarningBanner.tsx
// Affiché sur l'accueil si l'adresse de l'utilisateur ≠ son pays de résidence
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useLocationStore } from '@/stores/locationStore';
import { COUNTRIES } from '@/lib/countries';

export function CountryMismatchWarning() {
  const { profile } = useAuthStore();
  const { city } = useLocationStore();

  if (!profile?.country_code || !city) return null;

  // Vérifie si la ville de l'adresse correspond au pays de résidence
  const country = COUNTRIES.find((c) => c.code === profile.country_code);
  if (!country) return null;

  // Heuristique simple : si la ville contient le nom du pays ou une ville connue du pays
  // En production, utiliser la géolocalisation réelle
  const knownCities: Record<string, string[]> = {
    BJ: ['cotonou', 'porto-novo', 'parakou', 'bénin', 'benin'],
    CI: ['abidjan', 'yamoussoukro', 'bouaké', 'bouake', 'ivoire'],
    SN: ['dakar', 'thiès', 'thies', 'saint-louis', 'sénégal', 'senegal'],
    TG: ['lomé', 'lome', 'kara', 'sokodé', 'sokode', 'togo'],
  };

  const cityLower   = city.toLowerCase();
  const citiesForCountry = knownCities[profile.country_code] ?? [];
  const addressMatchesCountry = citiesForCountry.some((c) => cityLower.includes(c));

  if (addressMatchesCountry) return null;

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
          Votre adresse ne se trouve pas au {country.name}. Des frais supplémentaires peuvent s'appliquer pour la livraison.
        </Text>
      </View>
      <View style={styles.moreBtn}>
        <Text style={styles.moreText}>En savoir plus</Text>
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
