import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useState, useRef } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, MapPressEvent, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocationStore } from '@/stores/locationStore';
import { ALL_CITIES } from '@/types';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Tab = 'list' | 'map';

const DEFAULT_REGION: Region = {
  latitude: 6.3654,
  longitude: 2.4183,
  latitudeDelta: 0.5,
  longitudeDelta: 0.5,
};

export function LocationPickerModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { city, setCity } = useLocationStore();
  const [tab, setTab] = useState<Tab>('list');
  const [query, setQuery] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [markerCoords, setMarkerCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapRegion, setMapRegion] = useState<Region>(DEFAULT_REGION);
  const [reverseLoading, setReverseLoading] = useState(false);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const mapRef = useRef<MapView>(null);

  const filtered = ALL_CITIES.filter(
    (c) =>
      query.length === 0 ||
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.country.toLowerCase().includes(query.toLowerCase()),
  );

  const handleSelectCity = (name: string) => {
    setCity(name);
    setQuery('');
    onClose();
  };

  const handleManual = () => {
    if (query.trim().length > 2) handleSelectCity(query.trim());
  };

  const handleGPS = async () => {
    setGpsLoading(true);
    setGpsError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsError('Permission refusée');
        setGpsLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;

      if (tab === 'map') {
        const region = { latitude, longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 };
        setMarkerCoords({ latitude, longitude });
        setMapRegion(region);
        mapRef.current?.animateToRegion(region, 600);
        await reverseGeocode(latitude, longitude);
      } else {
        const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
        const name = place?.city ?? place?.subregion ?? place?.region ?? null;
        if (name) { setCity(name); onClose(); }
        else setGpsError('Position non reconnue');
      }
    } catch {
      setGpsError('Impossible de récupérer la position');
    }
    setGpsLoading(false);
  };

  const reverseGeocode = async (lat: number, lon: number) => {
    setReverseLoading(true);
    setPendingLabel(null);
    try {
      const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      if (place) {
        const label = [place.street, place.district ?? place.subregion, place.city]
          .filter(Boolean).join(', ');
        setPendingLabel(label || place.city || place.region || `${lat.toFixed(4)}, ${lon.toFixed(4)}`);
      } else {
        setPendingLabel(`${lat.toFixed(4)}, ${lon.toFixed(4)}`);
      }
    } catch {
      setPendingLabel(`${lat.toFixed(4)}, ${lon.toFixed(4)}`);
    }
    setReverseLoading(false);
  };

  const handleMapPress = async (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setMarkerCoords({ latitude, longitude });
    await reverseGeocode(latitude, longitude);
  };

  const handleConfirmMap = () => {
    if (pendingLabel) {
      setCity(pendingLabel);
      setPendingLabel(null);
      setMarkerCoords(null);
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.handle} />

        {/* Title + close */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>Adresse de livraison</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Feather name="x" size={22} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* GPS button */}
        <TouchableOpacity style={styles.gpsBtn} onPress={handleGPS} activeOpacity={0.8} disabled={gpsLoading}>
          {gpsLoading
            ? <ActivityIndicator size="small" color="#FF6835" />
            : <Feather name="navigation" size={18} color="#FF6835" />}
          <View style={{ flex: 1 }}>
            <Text style={styles.gpsBtnLabel}>Utiliser ma position actuelle</Text>
            {gpsError ? <Text style={styles.gpsError}>{gpsError}</Text> : null}
          </View>
          <Feather name="chevron-right" size={16} color="#D1D5DB" />
        </TouchableOpacity>

        {/* Tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'list' && styles.tabBtnActive]}
            onPress={() => setTab('list')}
          >
            <Feather name="list" size={14} color={tab === 'list' ? '#FF6835' : '#6B7280'} />
            <Text style={[styles.tabLabel, tab === 'list' && styles.tabLabelActive]}>Villes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'map' && styles.tabBtnActive]}
            onPress={() => setTab('map')}
          >
            <Feather name="map" size={14} color={tab === 'map' ? '#FF6835' : '#6B7280'} />
            <Text style={[styles.tabLabel, tab === 'map' && styles.tabLabelActive]}>Carte</Text>
          </TouchableOpacity>
        </View>

        {/* ── LIST TAB ── */}
        {tab === 'list' && (
          <>
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

            {query.trim().length > 2 && (
              <TouchableOpacity style={styles.confirmRow} onPress={handleManual} activeOpacity={0.8}>
                <Feather name="map-pin" size={16} color="#FF6835" />
                <Text style={styles.confirmText}>Livrer à « {query.trim()} »</Text>
                <Feather name="arrow-right" size={16} color="#FF6835" />
              </TouchableOpacity>
            )}

            <Text style={styles.sectionLabel}>Villes disponibles</Text>
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {filtered.map((c) => {
                const selected = city === c.name;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.cityRow, selected && styles.cityRowActive]}
                    onPress={() => handleSelectCity(c.name)}
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
          </>
        )}

        {/* ── MAP TAB ── */}
        {tab === 'map' && (
          <View style={styles.mapContainer}>
            <Text style={styles.mapHint}>
              <Feather name="info" size={12} color="#9CA3AF" /> Appuyez sur la carte pour placer votre adresse
            </Text>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={mapRegion}
              onPress={handleMapPress}
              showsUserLocation
              showsMyLocationButton={false}
            >
              {markerCoords && (
                <Marker coordinate={markerCoords} pinColor="#FF6835" />
              )}
            </MapView>

            {/* Pending address bar */}
            <View style={styles.mapFooter}>
              {reverseLoading ? (
                <View style={styles.mapAddressRow}>
                  <ActivityIndicator size="small" color="#FF6835" />
                  <Text style={styles.mapAddressText}>Identification de l'adresse…</Text>
                </View>
              ) : pendingLabel ? (
                <View style={styles.mapAddressRow}>
                  <Feather name="map-pin" size={16} color="#FF6835" />
                  <Text style={styles.mapAddressText} numberOfLines={2}>{pendingLabel}</Text>
                </View>
              ) : (
                <Text style={styles.mapPlaceholder}>Aucun point sélectionné</Text>
              )}
              <TouchableOpacity
                style={[styles.confirmMapBtn, !pendingLabel && styles.confirmMapBtnDisabled]}
                onPress={handleConfirmMap}
                disabled={!pendingLabel || reverseLoading}
                activeOpacity={0.85}
              >
                <Text style={styles.confirmMapBtnText}>Confirmer</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
    maxHeight: '90%',
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
  tabRow: {
    flexDirection: 'row', gap: 8,
    backgroundColor: '#F3F4F6', borderRadius: 12, padding: 4,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 8, borderRadius: 9,
  },
  tabBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabLabel: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  tabLabelActive: { color: '#FF6835' },
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
  mapContainer: { flex: 1, gap: 8, minHeight: 380 },
  mapHint: { fontSize: 12, color: '#9CA3AF', textAlign: 'center' },
  map: { flex: 1, borderRadius: 16, overflow: 'hidden', minHeight: 280 },
  mapFooter: {
    backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14, gap: 10,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  mapAddressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  mapAddressText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },
  mapPlaceholder: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },
  confirmMapBtn: {
    backgroundColor: '#FF6835', borderRadius: 12, paddingVertical: 12, alignItems: 'center',
  },
  confirmMapBtnDisabled: { backgroundColor: '#F3F4F6' },
  confirmMapBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
