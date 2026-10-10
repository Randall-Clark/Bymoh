/**
 * components/BusinessLocationPickerModal.tsx
 *
 * Même UX que LocationPickerModal (MapLibre floating pin, GPS watch, Nominatim)
 * mais destiné aux commerçants, avec des champs pro supplémentaires :
 *   • Type de bâtiment  : Boutique, Bureaux, Maison, Entrepôt, Marché, Autre
 *   • Étage / Numéro    (optionnel)
 *   • Détails           (optionnel — textarea)
 *
 * Flux : carte (floating pin) → formulaire (2 étapes, pas de liste sauvegardée)
 */

import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

/* ─── Types ──────────────────────────────────────────────────────── */
export interface BusinessAddressResult {
  address:      string;
  city:         string;
  lat:          number;
  lon:          number;
  buildingType: string;
  floor:        string;
  details:      string;
}

interface NominatimResult {
  place_id:     number;
  display_name: string;
  lat:          string;
  lon:          string;
}

type Step = 'map' | 'form';

interface Props {
  visible:   boolean;
  onClose:   () => void;
  onConfirm: (result: BusinessAddressResult) => void;
}

/* ─── Constants ──────────────────────────────────────────────────── */
const P           = '#FF6835';
const GPS_BLUE    = '#4285F4';
const DEFAULT_LAT = 6.3654;
const DEFAULT_LON = 2.4183;

const BUILDING_TYPES = [
  { key: 'boutique',  label: 'Boutique',  emoji: '🏪' },
  { key: 'bureaux',   label: 'Bureaux',   emoji: '🏢' },
  { key: 'maison',    label: 'Maison',    emoji: '🏠' },
  { key: 'entrepot',  label: 'Entrepôt',  emoji: '🏭' },
  { key: 'marche',    label: 'Marché',    emoji: '🛒' },
  { key: 'autre',     label: 'Autre',     emoji: '📍' },
];

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_H = SCREEN_H * 0.93;

/* ─── Nominatim helpers ──────────────────────────────────────────── */
async function reverseGeocode(lat: number, lon: number): Promise<{ address: string; city: string }> {
  try {
    const res  = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { 'Accept-Language': 'fr', 'User-Agent': 'Bymoh/1.0' } },
    );
    const data = await res.json();
    const a    = data.address ?? {};
    const road    = a.road ?? a.pedestrian ?? a.footway ?? a.neighbourhood ?? '';
    const number  = a.house_number ?? '';
    const city    = a.city ?? a.town ?? a.village ?? a.county ?? '';
    const address = ([number, road].filter(Boolean).join(' ')
                  || data.display_name?.split(',')[0]) ?? '';
    return { address: address.trim(), city: city.trim() };
  } catch {
    return { address: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, city: '' };
  }
}

async function searchNominatim(q: string): Promise<NominatimResult[]> {
  if (q.trim().length < 2) return [];
  try {
    const res  = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&accept-language=fr`,
      { headers: { 'User-Agent': 'Bymoh/1.0' } },
    );
    return await res.json();
  } catch {
    return [];
  }
}

/* ─── WebView HTML (floating pin, GPS bleu, barre de recherche) ─── */
const MAP_HTML = (lat: number, lon: number) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
  <script src="https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <link href="https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet"/>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    html,body,#map{width:100%;height:100%;}
    .zoom{position:absolute;right:12px;bottom:90px;display:flex;flex-direction:column;gap:6px;z-index:10;}
    .zbtn{width:40px;height:40px;border-radius:10px;background:#fff;border:none;
          font-size:22px;font-weight:700;color:#374151;
          box-shadow:0 2px 8px rgba(0,0,0,.18);cursor:pointer;
          display:flex;align-items:center;justify-content:center;}
    .zbtn:active{background:#f3f4f6;}
    .gps-wrap{position:relative;width:22px;height:22px;}
    .gps-pulse{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
      width:40px;height:40px;border-radius:50%;background:rgba(66,133,244,.2);
      animation:pulse 2s ease-out infinite;}
    .gps-dot{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
      width:16px;height:16px;border-radius:50%;background:${GPS_BLUE};
      border:3px solid #fff;box-shadow:0 2px 6px rgba(66,133,244,.6);}
    @keyframes pulse{0%{transform:translate(-50%,-50%) scale(0.6);opacity:.8}
                     100%{transform:translate(-50%,-50%) scale(2);opacity:0}}
    .maplibregl-ctrl-bottom-left,.maplibregl-ctrl-bottom-right,
    .maplibregl-ctrl-top-left,.maplibregl-ctrl-top-right{display:none!important;}
  </style>
</head>
<body>
<div id="map"></div>
<div class="zoom">
  <button class="zbtn" onclick="map.zoomIn()">+</button>
  <button class="zbtn" onclick="map.zoomOut()">−</button>
</div>
<script>
  var map = new maplibregl.Map({
    container:'map',
    style:'https://tiles.openfreemap.org/styles/positron',
    center:[${lon},${lat}],
    zoom:17,
    attributionControl:false
  });
  var gpsMarker = null;
  var mapReady  = false;
  var pendingGPS = null;
  map.on('load', function(){
    mapReady = true;
    if (pendingGPS) { _placeGPS(pendingGPS[0], pendingGPS[1]); pendingGPS = null; }
  });
  function _placeGPS(lng, lat) {
    if (!gpsMarker) {
      var wrap = document.createElement('div');
      wrap.className = 'gps-wrap';
      wrap.innerHTML = '<div class="gps-pulse"></div><div class="gps-dot"></div>';
      gpsMarker = new maplibregl.Marker({element:wrap, anchor:'center'})
        .setLngLat([lng,lat]).addTo(map);
    } else { gpsMarker.setLngLat([lng,lat]); }
  }
  function updateGPS(lng, lat) {
    if (!mapReady) { pendingGPS = [lng, lat]; return; }
    _placeGPS(lng, lat);
  }
  function sendPin() {
    var c = map.getCenter();
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'pin',lat:c.lat,lng:c.lng}));
  }
</script>
</body>
</html>`;

/* ─── HTML statique pour l'aperçu formulaire ─────────────────────── */
const MAP_HTML_STATIC = (lat: number, lon: number) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
  <script src="https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <link href="https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet"/>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}html,body,#map{width:100%;height:100%;}
    .mo{width:28px;height:28px;border-radius:50%;background:#FF6835;border:3px solid #fff;
        box-shadow:0 3px 8px rgba(255,104,53,.5);display:flex;align-items:center;justify-content:center;}
    .mi{width:8px;height:8px;border-radius:50%;background:#fff;}
    .maplibregl-ctrl-bottom-left,.maplibregl-ctrl-bottom-right{display:none!important;}
  </style>
</head>
<body>
<div id="map"></div>
<script>
  var map=new maplibregl.Map({
    container:'map',style:'https://tiles.openfreemap.org/styles/positron',
    center:[${lon},${lat}],zoom:16,interactive:false,attributionControl:false
  });
  var el=document.createElement('div');
  el.innerHTML='<div class="mo"><div class="mi"></div></div>';
  new maplibregl.Marker({element:el}).setLngLat([${lon},${lat}]).addTo(map);
</script>
</body>
</html>`;

/* ═══════════════════════════════════════════════════════════════════
   Composant
═══════════════════════════════════════════════════════════════════ */
export function BusinessLocationPickerModal({ visible, onClose, onConfirm }: Props) {
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(SCREEN_H)).current;

  const [step, setStep] = useState<Step>('map');

  /* carte */
  const [mapCenter, setMapCenter] = useState({ lat: DEFAULT_LAT, lon: DEFAULT_LON });
  const [mapKey,    setMapKey]    = useState(0);
  const webviewRef                = useRef<WebView>(null);
  const currentCenter             = useRef({ lat: DEFAULT_LAT, lon: DEFAULT_LON });
  const latestGPS                 = useRef<{ lat: number; lon: number } | null>(null);

  /* recherche */
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [searching,     setSearching]     = useState(false);
  const [showResults,   setShowResults]   = useState(false);
  const searchTimer                       = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* pin + géocodage */
  const [pinning, setPinning] = useState(false);
  const [mapAddr, setMapAddr] = useState('');
  const [mapCity, setMapCity] = useState('');

  /* GPS watch */
  const [locating, setLocating] = useState(false);
  const gpsSub = useRef<Location.LocationSubscription | null>(null);

  /* champs formulaire pro */
  const [buildingType, setBuildingType] = useState(BUILDING_TYPES[0].key);
  const [floor,        setFloor]        = useState('');
  const [details,      setDetails]      = useState('');

  /* ── Animation sheet ──────────────────────────────────────────── */
  useEffect(() => {
    if (visible) {
      setStep('map');
      setMapAddr('');
      setMapCity('');
      setSearchQuery('');
      setSearchResults([]);
      setShowResults(false);
      setBuildingType(BUILDING_TYPES[0].key);
      setFloor('');
      setDetails('');
      Animated.spring(slideY, { toValue: 0, tension: 68, friction: 12, useNativeDriver: true }).start();
      initMapPosition();
    } else {
      Animated.timing(slideY, { toValue: SCREEN_H, duration: 240, useNativeDriver: true }).start();
      gpsSub.current?.remove();
      gpsSub.current = null;
    }
  }, [visible]);

  /* ── GPS watch (carte uniquement) ────────────────────────────── */
  useEffect(() => {
    if (step !== 'map' || !visible) {
      gpsSub.current?.remove();
      gpsSub.current = null;
      return;
    }
    let active = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || !active) return;
      gpsSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
        (loc) => {
          const lat = loc.coords.latitude;
          const lon = loc.coords.longitude;
          latestGPS.current = { lat, lon };
          webviewRef.current?.injectJavaScript(`updateGPS(${lon}, ${lat}); true;`);
        },
      );
    })();
    return () => {
      active = false;
      gpsSub.current?.remove();
      gpsSub.current = null;
    };
  }, [step, visible]);

  /* ── Centrer sur GPS au démarrage ────────────────────────────── */
  const initMapPosition = async () => {
    try {
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        currentCenter.current = { lat, lon };
        setMapCenter({ lat, lon });
        setMapKey((k) => k + 1);
      }
    } catch {} finally { setLocating(false); }
  };

  const dismiss = () => {
    Keyboard.dismiss();
    Animated.timing(slideY, { toValue: SCREEN_H, duration: 240, useNativeDriver: true }).start(() => onClose());
  };

  /* ── Recherche Nominatim ─────────────────────────────────────── */
  const onSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.trim().length < 2) { setSearchResults([]); setShowResults(false); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      const results = await searchNominatim(text);
      setSearchResults(results);
      setShowResults(results.length > 0);
      setSearching(false);
    }, 500);
  };

  const onSearchResultPress = (item: NominatimResult) => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    setSearchQuery(item.display_name.split(',').slice(0, 2).join(', '));
    setSearchResults([]);
    setShowResults(false);
    Keyboard.dismiss();
    currentCenter.current = { lat, lon };
    setMapCenter({ lat, lon });
    setMapKey((k) => k + 1);
  };

  /* ── Recentrer GPS ───────────────────────────────────────────── */
  const recenterGPS = async () => {
    const gps = latestGPS.current;
    if (gps) {
      webviewRef.current?.injectJavaScript(
        `map.flyTo({center:[${gps.lon},${gps.lat}],zoom:17,essential:true}); true;`
      );
    } else {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        webviewRef.current?.injectJavaScript(
          `map.flyTo({center:[${lon},${lat}],zoom:17,essential:true}); true;`
        );
      } catch {}
    }
  };

  /* ── Message WebView (pin envoyé par sendPin()) ──────────────── */
  const onWebViewMessage = (e: any) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'pin') {
        currentCenter.current = { lat: msg.lat, lon: msg.lng };
        handlePinHere(msg.lat, msg.lng);
      }
    } catch {}
  };

  /* ── "Pin ici" → demande les coordonnées, puis géocode ──────── */
  const triggerPin = () => {
    webviewRef.current?.injectJavaScript(`sendPin(); true;`);
  };

  const handlePinHere = async (lat: number, lon: number) => {
    setPinning(true);
    setMapAddr('');
    setMapCity('');
    const { address, city } = await reverseGeocode(lat, lon);
    setMapAddr(address);
    setMapCity(city);
    setPinning(false);
    setStep('form');
  };

  /* ── Valider le formulaire ───────────────────────────────────── */
  const handleConfirm = () => {
    if (!mapAddr) return;
    const chosenType = BUILDING_TYPES.find((t) => t.key === buildingType)?.label ?? buildingType;
    onConfirm({
      address:      mapAddr,
      city:         mapCity,
      lat:          currentCenter.current.lat,
      lon:          currentCenter.current.lon,
      buildingType: chosenType,
      floor:        floor.trim(),
      details:      details.trim(),
    });
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      <TouchableWithoutFeedback onPress={dismiss}>
        <Animated.View style={[s.backdrop, {
          opacity: slideY.interpolate({ inputRange: [0, SCREEN_H], outputRange: [1, 0], extrapolate: 'clamp' }),
        }]} />
      </TouchableWithoutFeedback>

      <Animated.View style={[s.sheet, { transform: [{ translateY: slideY }] }]}>
        <View style={s.handle} />

        {/* ══════════════ ÉTAPE 1 : CARTE ══════════════ */}
        {step === 'map' && (
          <View style={{ flex: 1 }}>
            {/* Header */}
            <View style={s.header}>
              <TouchableOpacity onPress={dismiss} style={s.headerBtn}>
                <Feather name="x" size={20} color="#6B7280" />
              </TouchableOpacity>
              <Text style={s.headerTitle}>Localiser le commerce</Text>
              <View style={{ width: 38 }} />
            </View>

            {/* Barre de recherche */}
            <View style={s.searchBar}>
              <Feather name="search" size={16} color="#9CA3AF" />
              <TextInput
                style={s.searchInput}
                placeholder="Rechercher une adresse, quartier…"
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={onSearchChange}
                autoCorrect={false}
                returnKeyType="search"
              />
              {searching
                ? <ActivityIndicator size="small" color={P} />
                : searchQuery.length > 0
                  ? <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); setShowResults(false); }} hitSlop={8}>
                      <Feather name="x-circle" size={16} color="#C4C9D4" />
                    </TouchableOpacity>
                  : null
              }
            </View>

            {/* Dropdown résultats Nominatim */}
            {showResults && (
              <View style={s.searchDropdown}>
                {searchResults.map((item) => (
                  <TouchableOpacity
                    key={item.place_id}
                    style={s.searchResultRow}
                    onPress={() => onSearchResultPress(item)}
                  >
                    <Feather name="map-pin" size={14} color="#6B7280" />
                    <Text style={s.searchResultText} numberOfLines={2}>
                      {item.display_name.split(',').slice(0, 3).join(', ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Carte */}
            <View style={{ flex: 1, position: 'relative' }}>
              <WebView
                key={mapKey}
                ref={webviewRef}
                style={{ flex: 1 }}
                source={{ html: MAP_HTML(mapCenter.lat, mapCenter.lon) }}
                onMessage={onWebViewMessage}
                javaScriptEnabled
                domStorageEnabled
                originWhitelist={['*']}
                scrollEnabled={false}
                overScrollMode="never"
              />

              {/* Pin fixe au centre (overlay RN) */}
              <View style={s.floatingPinWrap} pointerEvents="none">
                <View style={s.pinCircle}>
                  <View style={s.pinDot} />
                </View>
                <View style={s.pinTip} />
                <View style={s.pinShadow} />
              </View>

              {/* Bouton GPS */}
              <TouchableOpacity style={s.gpsBtn} onPress={recenterGPS}>
                <Feather name="crosshair" size={20} color={P} />
              </TouchableOpacity>
            </View>

            {/* Footer carte */}
            <View style={[s.mapFooter, { paddingBottom: insets.bottom + 12 }]}>
              <Text style={s.mapHint}>Déplacez la carte pour positionner votre commerce</Text>
              <TouchableOpacity
                style={s.pinBtn}
                onPress={triggerPin}
                disabled={pinning}
                activeOpacity={0.88}
              >
                {pinning
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <>
                      <Feather name="check-circle" size={17} color="#fff" />
                      <Text style={s.pinBtnText}>Pin ici</Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ══════════════ ÉTAPE 2 : FORMULAIRE ══════════════ */}
        {step === 'form' && (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {/* Header */}
            <View style={s.header}>
              <TouchableOpacity onPress={() => setStep('map')} style={s.headerBtn}>
                <Feather name="arrow-left" size={22} color="#111827" />
              </TouchableOpacity>
              <Text style={s.headerTitle}>Détails de l'adresse</Text>
              <View style={{ width: 38 }} />
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
            >
              {/* Mini-carte statique */}
              <View style={s.miniMapWrap}>
                <WebView
                  style={s.miniMap}
                  source={{ html: MAP_HTML_STATIC(currentCenter.current.lat, currentCenter.current.lon) }}
                  javaScriptEnabled
                  domStorageEnabled
                  originWhitelist={['*']}
                  scrollEnabled={false}
                  pointerEvents="none"
                />
                <TouchableOpacity style={s.modifyBtn} onPress={() => setStep('map')}>
                  <Feather name="edit-2" size={13} color={P} />
                  <Text style={s.modifyBtnText}>Modifier</Text>
                </TouchableOpacity>
              </View>

              {/* Adresse géocodée */}
              {pinning
                ? <View style={s.addrBox}><ActivityIndicator size="small" color={P} /></View>
                : (
                  <View style={s.addrBox}>
                    <Feather name="map-pin" size={14} color={P} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.addrText} numberOfLines={2}>{mapAddr || '—'}</Text>
                      {mapCity ? <Text style={s.cityText}>{mapCity}</Text> : null}
                    </View>
                  </View>
                )
              }

              <View style={s.formContent}>
                {/* Type de bâtiment */}
                <View>
                  <Text style={s.fieldLabel}>Type de bâtiment</Text>
                  <View style={s.typesGrid}>
                    {BUILDING_TYPES.map((t) => {
                      const active = buildingType === t.key;
                      return (
                        <TouchableOpacity
                          key={t.key}
                          style={[s.typeChip, active && s.typeChipActive]}
                          onPress={() => setBuildingType(t.key)}
                          activeOpacity={0.8}
                        >
                          <Text style={s.typeEmoji}>{t.emoji}</Text>
                          <Text style={[s.typeLabel, active && s.typeLabelActive]}>{t.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Étage / Numéro */}
                <View>
                  <Text style={s.fieldLabel}>
                    Étage / Numéro{' '}
                    <Text style={s.optional}>(optionnel)</Text>
                  </Text>
                  <TextInput
                    style={s.field}
                    placeholder="ex : 2ème étage, N°14, Porte B…"
                    placeholderTextColor="#9CA3AF"
                    value={floor}
                    onChangeText={setFloor}
                    returnKeyType="next"
                  />
                </View>

                {/* Détails supplémentaires */}
                <View>
                  <Text style={s.fieldLabel}>
                    Détails supplémentaires{' '}
                    <Text style={s.optional}>(optionnel)</Text>
                  </Text>
                  <TextInput
                    style={[s.field, s.textarea]}
                    placeholder="ex : Face à la pharmacie, derrière le marché Dantokpa…"
                    placeholderTextColor="#9CA3AF"
                    value={details}
                    onChangeText={setDetails}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              </View>
            </ScrollView>

            {/* Bouton Valider */}
            <View style={[s.formFooter, { paddingBottom: insets.bottom + 16 }]}>
              <TouchableOpacity
                style={[s.confirmBtn, (!mapAddr || pinning) && s.confirmBtnDisabled]}
                onPress={handleConfirm}
                disabled={!mapAddr || pinning}
                activeOpacity={0.88}
              >
                <Feather name="check-circle" size={18} color="#fff" />
                <Text style={s.confirmBtnText}>Valider l'adresse</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}
      </Animated.View>
    </Modal>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────── */
const s = StyleSheet.create({
  backdrop:   { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet:      { position: 'absolute', bottom: 0, left: 0, right: 0, height: SHEET_H,
                backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  handle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB',
                alignSelf: 'center', marginTop: 10, marginBottom: 4 },

  /* Header */
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                 paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12,
                 borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerBtn:   { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: '#111827' },

  /* Barre de recherche */
  searchBar:   { flexDirection: 'row', alignItems: 'center', gap: 10,
                 marginHorizontal: 16, marginTop: 12, marginBottom: 8,
                 backgroundColor: '#F3F4F6', borderRadius: 100,
                 paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 12 : 10 },
  searchInput: { flex: 1, fontSize: 14, color: '#111827', padding: 0 },

  /* Dropdown résultats */
  searchDropdown:  { marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 14,
                     borderWidth: 1, borderColor: '#E5E7EB',
                     shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
                     shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
                     maxHeight: 200, overflow: 'hidden', zIndex: 99 },
  searchResultRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10,
                     paddingHorizontal: 14, paddingVertical: 12,
                     borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  searchResultText:{ flex: 1, fontSize: 13, color: '#374151', lineHeight: 18 },

  /* Floating pin overlay */
  floatingPinWrap: { position: 'absolute', top: '50%', left: '50%',
                     marginLeft: -18, marginTop: -46,
                     alignItems: 'center', width: 36 },
  pinCircle:  { width: 36, height: 36, borderRadius: 18, backgroundColor: P,
                borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center',
                shadowColor: P, shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.45, shadowRadius: 8, elevation: 8 },
  pinDot:     { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
  pinTip:     { width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8,
                borderStyle: 'solid', borderLeftColor: 'transparent',
                borderRightColor: 'transparent', borderTopColor: P, marginTop: -1 },
  pinShadow:  { width: 14, height: 5, borderRadius: 7, backgroundColor: 'rgba(0,0,0,0.13)', marginTop: 3 },

  /* GPS button */
  gpsBtn:     { position: 'absolute', bottom: 20, right: 16,
                width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff',
                alignItems: 'center', justifyContent: 'center',
                shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },

  /* Map footer */
  mapFooter:  { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 12,
                borderTopWidth: 1, borderTopColor: '#F3F4F6', gap: 10 },
  mapHint:    { fontSize: 12, color: '#9CA3AF', textAlign: 'center' },
  pinBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                backgroundColor: P, borderRadius: 100, paddingVertical: 15,
                shadowColor: P, shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  pinBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },

  /* Mini-carte */
  miniMapWrap: { height: 140, marginHorizontal: 16, marginTop: 14, borderRadius: 16,
                 overflow: 'hidden', backgroundColor: '#F3F4F6', position: 'relative' },
  miniMap:     { flex: 1 },
  modifyBtn:   { position: 'absolute', top: 8, right: 8, flexDirection: 'row',
                 alignItems: 'center', gap: 4, backgroundColor: '#fff', borderRadius: 100,
                 paddingHorizontal: 10, paddingVertical: 6,
                 shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                 shadowOpacity: 0.12, shadowRadius: 6, elevation: 3 },
  modifyBtnText: { fontSize: 12, fontWeight: '700', color: P },

  /* Adresse géocodée */
  addrBox:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8,
                backgroundColor: '#FEF2EC', borderRadius: 12, marginHorizontal: 16,
                marginTop: 10, padding: 12, borderWidth: 1, borderColor: '#FDDCCA' },
  addrText:   { fontSize: 13, fontWeight: '600', color: '#374151', lineHeight: 18 },
  cityText:   { fontSize: 11, fontWeight: '700', color: P, textTransform: 'uppercase',
                letterSpacing: 0.5, marginTop: 3 },

  /* Formulaire */
  formContent: { paddingHorizontal: 16, paddingTop: 16, gap: 18 },
  fieldLabel:  { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  optional:    { fontWeight: '400', color: '#9CA3AF' },
  field:       { backgroundColor: '#F9FAFB', borderRadius: 14, borderWidth: 1.5,
                 borderColor: '#E5E7EB', paddingHorizontal: 14, paddingVertical: 13,
                 fontSize: 14, color: '#111827' },
  textarea:    { minHeight: 84, paddingTop: 12 },

  /* Chips type bâtiment */
  typesGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip:       { flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 12, paddingVertical: 9,
                    borderRadius: 100, borderWidth: 1.5, borderColor: '#E5E7EB',
                    backgroundColor: '#fff' },
  typeChipActive: { borderColor: P, backgroundColor: '#FEF2EC' },
  typeEmoji:      { fontSize: 15 },
  typeLabel:      { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  typeLabelActive:{ color: P },

  /* Footer formulaire */
  formFooter:         { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 12,
                        borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  confirmBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                        backgroundColor: P, borderRadius: 100, paddingVertical: 16,
                        shadowColor: P, shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  confirmBtnDisabled: { backgroundColor: '#D1D5DB', shadowOpacity: 0 },
  confirmBtnText:     { fontSize: 15, fontWeight: '800', color: '#fff' },
});
