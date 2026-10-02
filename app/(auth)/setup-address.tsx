// app/(auth)/setup-address.tsx
// Étape finale d'inscription : définir l'adresse de livraison
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Platform, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LocationPickerModal } from '@/components/LocationPickerModal';
import { useLocationStore } from '@/stores/locationStore';

export default function SetupAddressScreen() {
  const insets = useSafeAreaInsets();
  const [pickerVisible, setPickerVisible] = useState(false);
  const { address, city } = useLocationStore() as any;

  const hasAddress = !!(address || city);

  const goToHome = () => router.replace('/(client)' as any);

  return (
    <View style={[styles.root, {
      paddingTop:    Platform.OS === 'web' ? 67 : insets.top + 20,
      paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 32,
    }]}>

      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconWrap}>
          <Feather name="map-pin" size={36} color="#FF6835" />
        </View>

        <Text style={styles.title}>Votre adresse de livraison</Text>
        <Text style={styles.subtitle}>
          Définissez votre adresse pour voir les commerces disponibles près de chez vous et recevoir vos commandes.
        </Text>

        {/* Adresse définie */}
        {hasAddress ? (
          <View style={styles.addressCard}>
            <View style={styles.addressIconWrap}>
              <Feather name="check-circle" size={20} color="#22C55E" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.addressLabel}>Adresse enregistrée</Text>
              <Text style={styles.addressValue}>{address ?? city}</Text>
            </View>
            <TouchableOpacity onPress={() => setPickerVisible(true)} style={styles.changeBtn}>
              <Text style={styles.changeBtnText}>Modifier</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.defineBtn}
            onPress={() => setPickerVisible(true)}
            activeOpacity={0.88}
          >
            <Feather name="map-pin" size={18} color="#FF6835" />
            <Text style={styles.defineBtnText}>Définir mon adresse</Text>
            <Feather name="chevron-right" size={16} color="#FF6835" />
          </TouchableOpacity>
        )}

        {/* Bouton principal */}
        <TouchableOpacity
          style={[styles.continueBtn, !hasAddress && styles.continueBtnSecondary]}
          onPress={goToHome}
          activeOpacity={0.88}
        >
          <Text style={[styles.continueBtnText, !hasAddress && styles.continueBtnTextSecondary]}>
            {hasAddress ? 'Accéder à Bymoh' : 'Définir plus tard'}
          </Text>
          {hasAddress && <Feather name="arrow-right" size={18} color="#fff" />}
        </TouchableOpacity>

        {hasAddress && (
          <TouchableOpacity onPress={goToHome} style={styles.skipRow}>
            <Text style={styles.skipText}>Passer cette étape</Text>
          </TouchableOpacity>
        )}
      </View>

      <LocationPickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:                { flex: 1, backgroundColor: '#F8F7F4' },
  content:             { flex: 1, paddingHorizontal: 24, gap: 20, justifyContent: 'center' },
  iconWrap:            { width: 72, height: 72, borderRadius: 22, backgroundColor: '#FEF2EC', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  title:               { fontSize: 28, fontWeight: '800', color: '#111827', textAlign: 'center' },
  subtitle:            { fontSize: 15, color: '#6B7280', lineHeight: 22, textAlign: 'center' },
  addressCard:         { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: '#BBF7D0' },
  addressIconWrap:     { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center' },
  addressLabel:        { fontSize: 11, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.4 },
  addressValue:        { fontSize: 14, fontWeight: '700', color: '#111827', marginTop: 2 },
  changeBtn:           { backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  changeBtnText:       { fontSize: 12, fontWeight: '600', color: '#374151' },
  defineBtn:           { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FEF2EC', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: '#FDDCCA' },
  defineBtnText:       { flex: 1, fontSize: 15, fontWeight: '700', color: '#FF6835' },
  continueBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#FF6835', borderRadius: 16, paddingVertical: 16, shadowColor: '#FF6835', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  continueBtnSecondary:{ backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', shadowOpacity: 0, elevation: 0 },
  continueBtnText:     { fontSize: 16, fontWeight: '700', color: '#fff' },
  continueBtnTextSecondary: { color: '#9CA3AF' },
  skipRow:             { alignItems: 'center' },
  skipText:            { fontSize: 13, color: '#9CA3AF' },
});
