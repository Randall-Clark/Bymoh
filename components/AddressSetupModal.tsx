// components/AddressSetupModal.tsx
// Modal affiché automatiquement après la création de compte
import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Platform,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useLocationStore } from '@/stores/locationStore';

interface Props {
  visible:  boolean;
  onDone:   () => void;  // appelé quand l'adresse est définie ou skippée
}

export function AddressSetupModal({ visible, onDone }: Props) {
  const insets = useSafeAreaInsets();
  const { profile, setProfile } = useAuthStore();
  const { setLocation } = useLocationStore();

  const [address,  setAddress]  = useState('');
  const [city,     setCity]     = useState('');
  const [loading,  setLoading]  = useState(false);

  const save = async () => {
    if (!address.trim() || !city.trim()) {
      Alert.alert('Champs requis', 'Veuillez entrer votre adresse et votre ville.');
      return;
    }
    if (!profile?.id) { onDone(); return; }

    setLoading(true);
    try {
      await supabase.from('users').update({
        delivery_address: address.trim(),
        delivery_city:    city.trim(),
      }).eq('id', profile.id);

      setProfile({ ...profile, delivery_address: address.trim(), delivery_city: city.trim() } as any);
      setLocation(city.trim(), address.trim(), 0, 0, profile.id);

      onDone();
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? 'Impossible de sauvegarder l\'adresse.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.card, { marginBottom: insets.bottom + 20 }]}>

          {/* Icône */}
          <View style={styles.iconWrap}>
            <Feather name="map-pin" size={32} color="#FF6835" />
          </View>

          <Text style={styles.title}>Définissez votre adresse</Text>
          <Text style={styles.subtitle}>
            Pour voir les commerces et offres disponibles près de vous, entrez votre adresse de résidence.
          </Text>

          {/* Champ adresse */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Adresse</Text>
            <View style={styles.inputWrap}>
              <Feather name="home" size={15} color="#9CA3AF" />
              <TextInput
                style={styles.input}
                placeholder="Rue, quartier, numéro…"
                placeholderTextColor="#9CA3AF"
                value={address}
                onChangeText={setAddress}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Champ ville */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Ville</Text>
            <View style={styles.inputWrap}>
              <Feather name="map-pin" size={15} color="#9CA3AF" />
              <TextInput
                style={styles.input}
                placeholder="Cotonou, Lomé, Dakar…"
                placeholderTextColor="#9CA3AF"
                value={city}
                onChangeText={setCity}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Bouton Confirmer */}
          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.7 }]}
            onPress={save}
            disabled={loading}
            activeOpacity={0.88}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Confirmer mon adresse</Text>}
          </TouchableOpacity>

          {/* Passer */}
          <TouchableOpacity onPress={onDone} style={styles.skipBtn}>
            <Text style={styles.skipText}>Définir plus tard</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card:       { backgroundColor: '#fff', borderRadius: 24, padding: 24, gap: 16, width: '100%', maxWidth: 400 },
  iconWrap:   { width: 64, height: 64, borderRadius: 20, backgroundColor: '#FEF2EC', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  title:      { fontSize: 22, fontWeight: '800', color: '#111827', textAlign: 'center' },
  subtitle:   { fontSize: 14, color: '#6B7280', lineHeight: 21, textAlign: 'center' },
  field:      { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4 },
  inputWrap:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1.5, borderColor: '#E5E7EB' },
  input:      { flex: 1, fontSize: 15, color: '#111827', padding: 0 },
  btn:        { backgroundColor: '#FF6835', borderRadius: 14, padding: 16, alignItems: 'center' },
  btnText:    { fontSize: 15, fontWeight: '700', color: '#fff' },
  skipBtn:    { alignItems: 'center', paddingVertical: 4 },
  skipText:   { fontSize: 13, color: '#9CA3AF', fontWeight: '600' },
});
