import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocationStore } from '@/stores/locationStore';
import { ALL_CITIES } from '@/types';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function LocationPickerModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { city, setCity } = useLocationStore();
  const [query, setQuery] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const filtered = ALL_CITIES.filter(
    (c) =>
      query.length === 0 ||
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.country.toLowerCase().includes(query.toLowerCase()),
  );

  const handleSelect = (name: string) => {
    setCity(name);
    setQuery('');
    onClose();
  };

  const handleGPS = async () => {
    setGpsLoading(true);
    setGpsError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsError('Permission de localisation refusée');
        setGpsLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync(loc.coords);
      const name = place?.city ?? place?.subregion ?? place?.region ?? null;
      if (name) {
        setCity(name);
        onClose();
      } else {
        setGpsError('Position non reconnue');
      }
    } catch {
      setGpsError('Impossible de récupérer la position');
    }
    setGpsLoading(false);
  };

  const handleManual = () => {
    if (query.trim().length > 0) {
      handleSelect(query.trim());
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />

        {/* Title row */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>Votre adresse de livraison</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Feather name="x" size={22} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* GPS button */}
        <TouchableOpacity style={styles.gpsBtn} onPress={handleGPS} activeOpacity={0.8} disabled={gpsLoading}>
          {gpsLoading ? (
            <ActivityIndicator size="small" color="#FF6835" />
          ) : (
            <Feather name="navigation" size={18} color="#FF6835" />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.gpsBtnLabel}>Utiliser ma position actuelle</Text>
            {gpsError && <Text style={styles.gpsError}>{gpsError}</Text>}
          </View>
          <Feather name="chevron-right" size={16} color="#D1D5DB" />
        </TouchableOpacity>

        {/* Search input */}
        <View style={styles.inputRow}>
          <Feather name="search" size={16} color="#9CA3AF" />
          <TextInput
            style={styles.input}
            placeholder="Chercher une ville ou saisir une adresse..."
            placeholderTextColor="#9CA3AF"
            value={query}
            onChangeText={setQuery}
            returnKeyType="done"
            onSubmitEditing={handleManual}
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <Feather name="x-circle" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Confirm manual entry */}
        {query.trim().length > 2 && (
          <TouchableOpacity style={styles.confirmRow} onPress={handleManual} activeOpacity={0.8}>
            <Feather name="map-pin" size={16} color="#FF6835" />
            <Text style={styles.confirmText}>Livrer à « {query.trim()} »</Text>
            <Feather name="arrow-right" size={16} color="#FF6835" />
          </TouchableOpacity>
        )}

        {/* City list */}
        <Text style={styles.sectionLabel}>Villes disponibles</Text>
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {filtered.map((c) => {
            const selected = city === c.name;
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.cityRow, selected && styles.cityRowActive]}
                onPress={() => handleSelect(c.name)}
                activeOpacity={0.7}
              >
                <Text style={styles.cityFlag}>{c.flag}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cityName, selected && styles.cityNameActive]}>{c.name}</Text>
                  <Text style={styles.cityCountry}>{c.country}</Text>
                </View>
                {selected && <Feather name="check" size={18} color="#FF6835" />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: '80%',
    gap: 12,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 4,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 17, fontWeight: '800', color: '#111827' },
  gpsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FEF2EC', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#FED7AA',
  },
  gpsBtnLabel: { fontSize: 14, fontWeight: '600', color: '#FF6835' },
  gpsError: { fontSize: 12, color: '#EF4444', marginTop: 2 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  input: { flex: 1, fontSize: 14, color: '#111827', padding: 0 },
  confirmRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FEF2EC', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#FED7AA',
  },
  confirmText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#FF6835' },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },
  list: { flexShrink: 1 },
  cityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F3F4F6',
  },
  cityRowActive: { backgroundColor: '#FEF2EC', borderRadius: 12, paddingHorizontal: 8 },
  cityFlag: { fontSize: 24 },
  cityName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  cityNameActive: { color: '#FF6835' },
  cityCountry: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
});
