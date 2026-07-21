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
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocationStore } from '@/stores/locationStore';
import { ALL_CITIES } from '@/types';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Tab = 'list' | 'map';

function buildLeafletHtml(lat: number, lon: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body, #map { width:100%; height:100%; }
    .leaflet-control-attribution { display:none; }
    .confirm-bar {
      position:absolute; bottom:0; left:0; right:0; z-index:9999;
      background:#fff; padding:12px 16px;
      border-top:1px solid #E5E7EB;
      display:flex; align-items:center; gap:10px;
    }
    .confirm-bar span {
      flex:1; font-size:13px; color:#111827; font-family:sans-serif;
      overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
    }
    .confirm-btn {
      background:#FF6835; color:#fff; border:none; border-radius:10px;
      padding:10px 18px; font-size:14px; font-weight:700; cursor:pointer;
      font-family:sans-serif; white-space:nowrap;
    }
    .hint {
      position:absolute; top:8px; left:50%; transform:translateX(-50%);
      z-index:9999; background:rgba(0,0,0,0.6); color:#fff;
      padding:6px 14px; border-radius:20px; font-size:12px;
      font-family:sans-serif; pointer-events:none; white-space:nowrap;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="hint" id="hint">Appuyez sur la carte pour choisir</div>
  <div class="confirm-bar" id="bar" style="display:none">
    <span id="addr">—</span>
    <button class="confirm-btn" onclick="confirm()">Confirmer</button>
  </div>
  <script>
    var map = L.map('map', { zoomControl:true }).setView([${lat},${lon}], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom:19
    }).addTo(map);

    var marker = null;
    var chosen = null;

    var icon = L.divIcon({
      html:'<div style="width:28px;height:28px;background:#FF6835;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>',
      iconSize:[28,28], iconAnchor:[14,28], className:''
    });

    map.on('click', function(e){
      var lat = e.latlng.lat, lon = e.latlng.lng;
      chosen = {lat: lat, lon: lon};
      if (marker) marker.setLatLng(e.latlng);
      else marker = L.marker(e.latlng, {icon:icon}).addTo(map);
      document.getElementById('hint').style.display = 'none';
      document.getElementById('addr').textContent = lat.toFixed(5) + ', ' + lon.toFixed(5);
      document.getElementById('bar').style.display = 'flex';
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'pick', lat:lat, lon:lon}));
    });

    function confirm(){
      if (chosen) window.ReactNativeWebView.postMessage(JSON.stringify({type:'confirm', lat:chosen.lat, lon:chosen.lon}));
    }
  </script>
</body>
</html>`;
}

export function LocationPickerModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { city, setCity } = useLocationStore();
  const [tab, setTab] = useState<Tab>('list');
  const [query, setQuery] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 6.3654, lon: 2.4183 });
  const [reverseLoading, setReverseLoading] = useState(false);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const webviewKey = useRef(0);

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

  const reverseGeocode = async (lat: number, lon: number) => {
    setReverseLoading(true);
    setPendingLabel(null);
    try {
      const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      if (place) {
        const label = [place.street, place.district ?? place.subregion, place.city]
          .filter(Boolean).join(', ');
        setPendingLabel(label || place.city || `${lat.toFixed(4)}, ${lon.toFixed(4)}`);
      } else {
        setPendingLabel(`${lat.toFixed(4)}, ${lon.toFixed(4)}`);
      }
    } catch {
      setPendingLabel(`${lat.toFixed(4)}, ${lon.toFixed(4)}`);
    }
    setReverseLoading(false);
  };

  const handleGPS = async () => {
    setGpsLoading(true);
    setGpsError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setGpsError('Permission refusée'); setGpsLoading(false); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;

      if (tab === 'map') {
        setMapCenter({ lat: latitude, lon: longitude });
        webviewKey.current += 1;
      } else {
        const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
        const name = place?.city ?? place?.subregion ?? place?.region ?? null;
        if (name) { setCity(name); onClose(); }
        else setGpsError('Position non reconnue');
      }
    } catch { setGpsError('Impossible de récupérer la position'); }
    setGpsLoading(false);
  };

  const handleWebViewMessage = async (event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'pick') {
        await reverseGeocode(msg.lat, msg.lon);
      } else if (msg.type === 'confirm') {
        if (pendingLabel) {
          setCity(pendingLabel);
          setPendingLabel(null);
          onClose();
        }
      }
    } catch { /* ignore parse errors */ }
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
          {(['list', 'map'] as Tab[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
              onPress={() => setTab(t)}
            >
              <Feather name={t === 'list' ? 'list' : 'map'} size={14} color={tab === t ? '#FF6835' : '#6B7280'} />
              <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
                {t === 'list' ? 'Villes' : 'Carte'}
              </Text>
            </TouchableOpacity>
          ))}
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
            {reverseLoading && (
              <View style={styles.reverseBar}>
                <ActivityIndicator size="small" color="#FF6835" />
                <Text style={styles.reverseText}>Identification de l'adresse…</Text>
              </View>
            )}
            {pendingLabel && !reverseLoading && (
              <View style={styles.reverseBar}>
                <Feather name="map-pin" size={14} color="#FF6835" />
                <Text style={styles.reverseText} numberOfLines={1}>{pendingLabel}</Text>
              </View>
            )}
            <WebView
              key={webviewKey.current}
              style={styles.map}
              source={{ html: buildLeafletHtml(mapCenter.lat, mapCenter.lon) }}
              onMessage={handleWebViewMessage}
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={['*']}
              scrollEnabled={false}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            />
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
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 17, fontWeight: '800', color: '#111827' },
  gpsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FEF2EC', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#FED7AA',
  },
  gpsBtnLabel: { fontSize: 14, fontWeight: '600', color: '#FF6835' },
  gpsError: { fontSize: 12, color: '#EF4444', marginTop: 2 },
  tabRow: { flexDirection: 'row', gap: 8, backgroundColor: '#F3F4F6', borderRadius: 12, padding: 4 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 9 },
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
  mapContainer: { flex: 1, minHeight: 360, gap: 8 },
  reverseBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2EC', borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: '#FED7AA',
  },
  reverseText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#FF6835' },
  map: { flex: 1, borderRadius: 16, overflow: Platform.OS === 'android' ? 'hidden' : 'visible' },
});
