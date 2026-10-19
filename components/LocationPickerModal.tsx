/**
 * components/LocationPickerModal.tsx
 *
 * 3 étapes :
 *  'list'  — adresses sauvegardées (AsyncStorage)
 *  'map'   — carte MapLibre, floating pin, point GPS bleu, barre de recherche
 *  'form'  — label, complément, sauvegarde locale, partage
 *
 * Logique géocodage :
 *  - PAS de géocodage automatique pendant le déplacement de la carte
 *  - Géocodage déclenché UNIQUEMENT quand on appuie sur "Pin ici"
 *  - Barre de recherche Nominatim pour trouver une adresse connue
 *  - Point bleu GPS via expo-location watchPosition + injectJavaScript
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import Entypo from '@expo/vector-icons/Entypo';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocationStore } from '@/stores/locationStore';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

/* ─── Types ─────────────────────────────────────────────────────── */
interface SavedAddr {
  id:          string;
  label:       string;
  address:     string;
  city:        string;
  suburb?:     string;  // ← quartier extrait de Nominatim
  lat:         number;
  lon:         number;
  complement?: string;
  accessCode?: string;  // code d'accès ou numéro à appeler à l'arrivée
}
interface NominatimResult {
  place_id:     number;
  display_name: string;
  lat:          string;
  lon:          string;
}
type Step = 'list' | 'map' | 'form';

interface Props { visible: boolean; onClose: () => void; }

/* ─── Constants ──────────────────────────────────────────────────── */
const STORAGE_KEY   = 'bymoh_saved_addresses';
const P             = '#FF6835';
const GPS_BLUE      = '#4285F4';
const LABEL_OPTIONS = [
  { key: 'Maison',  label: 'Maison',  Icon: (p: any) => <FontAwesome5 name="home"      size={13} {...p} /> },
  { key: 'Travail', label: 'Travail', Icon: (p: any) => <Entypo       name="briefcase" size={13} {...p} /> },
  { key: 'Autre',   label: 'Autre',   Icon: (p: any) => <Feather      name="map-pin"   size={13} {...p} /> },
] as const;
const DEFAULT_LAT   = 6.3654;
const DEFAULT_LON   = 2.4183;

/* ─── Nominatim helpers ──────────────────────────────────────────── */
async function reverseGeocode(lat: number, lon: number): Promise<{ address: string; city: string; suburb: string }> {
  try {
    const res  = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { 'Accept-Language': 'fr', 'User-Agent': 'Bymoh/1.0' } },
    );
    const data = await res.json();
    const a    = data.address ?? {};

    // Ville : ce que Nominatim retourne (ex: "Godomey", "Cotonou", "Lomé")
    const city   = (a.city ?? a.town ?? a.village ?? a.county ?? '').trim();
    // Quartier fin (ex: "Dénou", "Haie-Vive")
    const suburb = (a.suburb ?? a.quarter ?? a.neighbourhood ?? a.city_district ?? '').trim();

    // Adresse : numéro + rue
    const road   = a.road ?? a.pedestrian ?? a.footway ?? '';
    const number = a.house_number ?? '';
    const street = ([number, road].filter(Boolean).join(' ') || data.display_name?.split(',')[0] || '').trim();

    return { address: street, city, suburb };
  } catch {
    return { address: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, city: '', suburb: '' };
  }
}

async function searchNominatim(q: string): Promise<NominatimResult[]> {
  if (q.trim().length < 2) return [];
  try {
    const res  = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=10&accept-language=fr&countrycodes=bj,ci,sn,ml,bf,tg,gh,ng,gn,cm&viewbox=-17.5,25.0,15.0,4.0&bounded=0`,
      { headers: { 'User-Agent': 'Bymoh/1.0' } },
    );
    return await res.json();
  } catch {
    return [];
  }
}

/* ─── WebView HTML ───────────────────────────────────────────────── */
// - Pas de map.on('move') — pas de géocodage continu
// - Point GPS bleu mis à jour via injectJavaScript (updateGPS)
// - Envoie les coordonnées du centre UNIQUEMENT quand sendPin() est appelé depuis RN
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

    /* Zoom buttons */
    .zoom{position:absolute;right:12px;bottom:90px;display:flex;flex-direction:column;gap:6px;z-index:10;}
    .zbtn{width:40px;height:40px;border-radius:10px;background:#fff;border:none;
          font-size:22px;font-weight:700;color:#374151;
          box-shadow:0 2px 8px rgba(0,0,0,.18);cursor:pointer;
          display:flex;align-items:center;justify-content:center;}
    .zbtn:active{background:#f3f4f6;}

    /* Point GPS bleu pulsant */
    .gps-wrap{position:relative;width:22px;height:22px;}
    .gps-pulse{
      position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
      width:40px;height:40px;border-radius:50%;
      background:rgba(66,133,244,.2);
      animation:pulse 2s ease-out infinite;
    }
    .gps-dot{
      position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
      width:16px;height:16px;border-radius:50%;
      background:${GPS_BLUE};border:3px solid #fff;
      box-shadow:0 2px 6px rgba(66,133,244,.6);
    }
    @keyframes pulse{0%{transform:translate(-50%,-50%) scale(0.6);opacity:.8}
                     100%{transform:translate(-50%,-50%) scale(2);opacity:0}}

    /* Masquer les contrôles MapLibre par défaut */
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

  /* ── Point GPS bleu ── */
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
    } else {
      gpsMarker.setLngLat([lng,lat]);
    }
  }

  /* Appelé par injectJavaScript depuis RN quand la position GPS change */
  function updateGPS(lng, lat) {
    if (!mapReady) { pendingGPS = [lng, lat]; return; }
    _placeGPS(lng, lat);
  }

  /* Appelé par injectJavaScript quand l'utilisateur appuie sur "Pin ici" */
  function sendPin() {
    var c = map.getCenter();
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'pin',lat:c.lat,lng:c.lng}));
  }
</script>
</body>
</html>`;

/* ─── HTML statique pour l'aperçu ───────────────────────────────── */
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
export default function LocationPickerModal({ visible, onClose }: Props) {
  const { setLocation, lat: activeLat, lon: activeLon } = useLocationStore();
  const userId = useAuthStore(s => s.session?.user?.id ?? null);

  /* navigation */
  const [step, setStep] = useState<Step>('list');

  /* adresses sauvegardées */
  const [savedAddrs, setSavedAddrs] = useState<SavedAddr[]>([]);

  /* carte */
  const [mapCenter,    setMapCenter]    = useState({ lat: DEFAULT_LAT, lon: DEFAULT_LON });
  const [mapKey,       setMapKey]       = useState(0);
  const webviewRef                      = useRef<WebView>(null);
  const currentCenter                   = useRef({ lat: DEFAULT_LAT, lon: DEFAULT_LON });
  const latestGPS                       = useRef<{ lat: number; lon: number } | null>(null);

  /* recherche */
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [searching,     setSearching]     = useState(false);
  const [showResults,   setShowResults]   = useState(false);
  const searchTimer                       = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* pin + géocodage (déclenché par "Pin ici") */
  const [pinning,    setPinning]    = useState(false); // géocodage en cours après Pin ici
  const [mapAddr,    setMapAddr]    = useState('');
  const [mapCity,    setMapCity]    = useState('');
  const [mapSuburb,  setMapSuburb]  = useState('');   // ← nouveau : quartier géocodé

  /* formulaire */
  const [label,      setLabel]      = useState('');
  const [complement, setComplement] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [saveLocal,  setSaveLocal]  = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [editingId,  setEditingId]  = useState<string | null>(null); // ID de l'adresse en cours d'édition

  /* GPS watch */
  const [locating, setLocating] = useState(false);
  const gpsSub = useRef<Location.LocationSubscription | null>(null);

  /* ──────────────────────────────────────────────────────────────
     AsyncStorage
  ────────────────────────────────────────────────────────────── */
  const loadSaved = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      setSavedAddrs(raw ? JSON.parse(raw) : []);
    } catch { setSavedAddrs([]); }
  }, []);

  useEffect(() => {
    if (visible) { loadSaved(); setStep('list'); }
    else { gpsSub.current?.remove(); gpsSub.current = null; }
  }, [visible, loadSaved]);

  /* ──────────────────────────────────────────────────────────────
     GPS watch — démarre quand on est sur la carte
  ────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (step !== 'map') {
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
          // Met à jour le point bleu dans la WebView
          webviewRef.current?.injectJavaScript(
            `updateGPS(${lon}, ${lat}); true;`
          );
        },
      );
    })();
    return () => {
      active = false;
      gpsSub.current?.remove();
      gpsSub.current = null;
    };
  }, [step]);

  /* ──────────────────────────────────────────────────────────────
     Ouvrir la carte
  ────────────────────────────────────────────────────────────── */
  const openMap = useCallback(async (initLat?: number, initLon?: number) => {
    setMapAddr('');
    setMapCity('');
    setMapSuburb('');
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);

    let lat = initLat ?? DEFAULT_LAT;
    let lon = initLon ?? DEFAULT_LON;

    if (initLat === undefined) {
      // Essayer de centrer sur la position GPS actuelle
      try {
        setLocating(true);
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          lat = pos.coords.latitude;
          lon = pos.coords.longitude;
        }
      } catch { /* ignore */ }
      finally { setLocating(false); }
    }

    currentCenter.current = { lat, lon };
    setMapCenter({ lat, lon });
    setMapKey(k => k + 1);
    setStep('map');
  }, []);

  /* ──────────────────────────────────────────────────────────────
     Message WebView → RN
  ────────────────────────────────────────────────────────────── */
  const onWebViewMessage = useCallback((e: any) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'pin') {
        // Géocodage après "Pin ici"
        handlePin(msg.lat, msg.lng);
      }
    } catch { /* ignore */ }
  }, []);

  const handlePin = useCallback(async (lat: number, lng: number) => {
    currentCenter.current = { lat, lon: lng };
    setPinning(true);
    setMapAddr('…');
    setMapCity('');
    setMapSuburb('');
    setStep('form');
    // Pré-remplir les champs si on édite une adresse existante
    const existing = editingId ? savedAddrs.find(a => a.id === editingId) : null;
    setLabel(existing?.label ?? '');
    setComplement(existing?.complement ?? '');
    setAccessCode(existing?.accessCode ?? '');
    setSaveLocal(true);
    const { address, city, suburb } = await reverseGeocode(lat, lng);
    setMapAddr(address);
    setMapCity(city);
    setMapSuburb(suburb);
    setPinning(false);
  }, [editingId, savedAddrs]);

  /* ──────────────────────────────────────────────────────────────
     "Pin ici" — demande à la WebView d'envoyer le centre actuel
  ────────────────────────────────────────────────────────────── */
  const handlePinIci = useCallback(() => {
    webviewRef.current?.injectJavaScript(`sendPin(); true;`);
  }, []);

  /* ──────────────────────────────────────────────────────────────
     Recentrer sur la position GPS
  ────────────────────────────────────────────────────────────── */
  const recenterGPS = useCallback(() => {
    const gps = latestGPS.current;
    if (!gps) { Alert.alert('GPS', 'Position GPS non encore disponible.'); return; }
    webviewRef.current?.injectJavaScript(
      `map.flyTo({center:[${gps.lon},${gps.lat}],zoom:17,essential:true}); true;`
    );
  }, []);

  /* ──────────────────────────────────────────────────────────────
     Recherche Nominatim
  ────────────────────────────────────────────────────────────── */
  const onSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    setShowResults(false);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.trim().length < 2) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      const results = await searchNominatim(text);
      setSearchResults(results);
      setShowResults(results.length > 0);
      setSearching(false);
    }, 500);
  }, []);

  const onSelectResult = useCallback((result: NominatimResult) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    Keyboard.dismiss();
    setShowResults(false);
    setSearchQuery(result.display_name.split(',')[0]);
    webviewRef.current?.injectJavaScript(
      `map.flyTo({center:[${lon},${lat}],zoom:17,essential:true}); true;`
    );
  }, []);

  /* ──────────────────────────────────────────────────────────────
     Adresse affichée dans l'UI : "Quartier, Ville" ou juste "Ville"
  ────────────────────────────────────────────────────────────── */
  const displayAddress = mapSuburb && mapCity
    ? `${mapSuburb}, ${mapCity}`
    : mapAddr || mapCity || '';

  /* ──────────────────────────────────────────────────────────────
     Sauvegarder l'adresse
  ────────────────────────────────────────────────────────────── */
  const handleSave = useCallback(async () => {
    const { lat, lon } = currentCenter.current;
    // finalLabel : label choisi > quartier seul > rue seule > coordonnées
    // (on n'utilise PAS displayAddress ici pour éviter "Quartier, Ville" comme label)
    const finalLabel  = label.trim() || mapSuburb || mapAddr || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    // fullAddress : quartier + rue + complément
    const addrParts = [mapSuburb, mapAddr].filter(Boolean).join(', ') || displayAddress;
    const fullAddress = [addrParts, complement.trim()].filter(Boolean).join(', ');

    setSaving(true);
    try {
      if (userId) {
        await supabase.from('users').update({
          delivery_address: fullAddress,
          delivery_city:    mapCity,
          delivery_lat:     lat,
          delivery_lon:     lon,
        }).eq('id', userId);
      }
      // ✅ On passe suburb en 7e argument
      setLocation(mapCity, fullAddress, lat, lon, userId ?? '', finalLabel, mapSuburb);

      if (saveLocal) {
        const updatedAddr: SavedAddr = {
          id:         editingId ?? Date.now().toString(), // garde l'ID si édition
          label:      finalLabel,
          address:    fullAddress,
          city:       mapCity,
          suburb:     mapSuburb || undefined,
          lat,
          lon,
          complement: complement.trim() || undefined,
          accessCode: accessCode.trim() || undefined,
        };
        const updated = editingId
          // Édition : remplace l'adresse existante à sa position
          ? savedAddrs.map(a => a.id === editingId ? updatedAddr : a)
          // Nouvelle adresse : ajoute en tête (déduplique par position)
          : [
              updatedAddr,
              ...savedAddrs.filter(a =>
                Math.abs(a.lat - lat) > 0.0002 || Math.abs(a.lon - lon) > 0.0002
              ),
            ].slice(0, 10);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        setSavedAddrs(updated);
      }
      setEditingId(null); // reset après sauvegarde
      onClose();
    } catch {
      Alert.alert('Erreur', 'Impossible de sauvegarder l\'adresse.');
    } finally {
      setSaving(false);
    }
  }, [label, complement, mapAddr, mapCity, mapSuburb, displayAddress, saveLocal, savedAddrs, setLocation, userId, onClose]);

  /* ──────────────────────────────────────────────────────────────
     Sélectionner une adresse sauvegardée
  ────────────────────────────────────────────────────────────── */
  const selectSaved = useCallback(async (addr: SavedAddr) => {
    setSaving(true);
    try {
      if (userId) {
        await supabase.from('users').update({
          delivery_address: addr.address,
          delivery_city:    addr.city,
          delivery_lat:     addr.lat,
          delivery_lon:     addr.lon,
        }).eq('id', userId);
      }
      setLocation(addr.city, addr.address, addr.lat, addr.lon, userId ?? '', addr.label, addr.suburb);
      onClose();
    } catch {
      Alert.alert('Erreur', 'Impossible de sélectionner l\'adresse.');
    } finally { setSaving(false); }
  }, [setLocation, userId, onClose]);

  const deleteSaved = useCallback(async (id: string) => {
    const updated = savedAddrs.filter(a => a.id !== id);
    setSavedAddrs(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, [savedAddrs]);

  const shareAddr = useCallback(async (addr: SavedAddr) => {
    const mapsUrl = `https://maps.google.com/?q=${addr.lat},${addr.lon}`;
    const lines: string[] = [mapsUrl];
    if (addr.complement) lines.push(`🏠 ${addr.complement}`);
    if (addr.accessCode) lines.push(`🔑 ${addr.accessCode}`);
    const message = lines.join('\n');
    try {
      await Share.share(
        Platform.OS === 'ios'
          ? { message, url: mapsUrl }
          : { message },
      );
    } catch { /* annulé par l'utilisateur */ }
  }, []);

  const openInMaps = useCallback((lat: number, lon: number) => {
    const url = Platform.OS === 'ios'
      ? `http://maps.apple.com/?ll=${lat},${lon}`
      : `https://maps.google.com/?q=${lat},${lon}`;
    Linking.openURL(url);
  }, []);

  /* ════════════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════════ */
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.root}>

        {/* ══════════════════════════════
            LISTE
        ══════════════════════════════ */}
        {step === 'list' && (
          <>
            <View style={s.header}>
              <Text style={s.headerTitle}>Adresse de livraison</Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <Feather name="x" size={22} color="#374151" />
              </Pressable>
            </View>

            <FlatList
              data={savedAddrs}
              keyExtractor={item => item.id}
              contentContainerStyle={s.listContent}
              ListHeaderComponent={
                <TouchableOpacity style={s.newBtn} onPress={() => { setEditingId(null); openMap(); }}>
                  <View style={s.newBtnIcon}>
                    {locating
                      ? <ActivityIndicator size="small" color={P} />
                      : <Feather name="plus" size={20} color={P} />
                    }
                  </View>
                  <View>
                    <Text style={s.newBtnTitle}>Nouvelle adresse</Text>
                    <Text style={s.newBtnSub}>Se centre sur votre position GPS</Text>
                  </View>
                </TouchableOpacity>
              }
              ListEmptyComponent={
                <View style={s.emptyBox}>
                  <Feather name="map-pin" size={44} color="#D1D5DB" />
                  <Text style={s.emptyTitle}>Aucune adresse sauvegardée</Text>
                  <Text style={s.emptySub}>
                    Ajoutez votre adresse maison ou travail pour la retrouver facilement
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const isActive = activeLat !== null && activeLon !== null
                  && Math.abs(item.lat - (activeLat ?? 0)) < 0.0003
                  && Math.abs(item.lon - (activeLon ?? 0)) < 0.0003;
                return (
                <View style={[s.addrCard, isActive && s.addrCardActive]}>
                  <Pressable style={s.addrMain} onPress={() => selectSaved(item)}>
                    <View style={[s.addrIconWrap, isActive && s.addrIconWrapActive]}>
                      <Feather name={isActive ? 'check' : 'map-pin'} size={15} color={isActive ? '#fff' : P} />
                    </View>
                    <View style={s.addrTexts}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={s.addrLabel} numberOfLines={1}>{item.label}</Text>
                        {isActive && (
                          <View style={s.activeBadge}>
                            <Text style={s.activeBadgeTxt}>En cours</Text>
                          </View>
                        )}
                      </View>
                      <Text style={s.addrSub} numberOfLines={1}>{item.address}</Text>
                    </View>
                  </Pressable>
                  <View style={s.addrActions}>
                    <Pressable hitSlop={10} style={s.iconBtn} onPress={() => shareAddr(item)}>
                      <Feather name="share-2" size={16} color="#9CA3AF" />
                    </Pressable>
                    <Pressable hitSlop={10} style={s.iconBtn} onPress={() => { setEditingId(item.id); openMap(item.lat, item.lon); }}>
                      <Feather name="edit-2" size={16} color="#9CA3AF" />
                    </Pressable>
                    <Pressable
                      hitSlop={10}
                      style={s.iconBtn}
                      onPress={() =>
                        Alert.alert('Supprimer', `Supprimer "${item.label}" ?`, [
                          { text: 'Annuler', style: 'cancel' },
                          { text: 'Supprimer', style: 'destructive', onPress: () => deleteSaved(item.id) },
                        ])
                      }
                    >
                      <Feather name="trash-2" size={16} color="#EF4444" />
                    </Pressable>
                  </View>
                </View>
                );
              }}
            />
          </>
        )}

        {/* ══════════════════════════════
            CARTE
        ══════════════════════════════ */}
        {step === 'map' && (
          <View style={s.mapContainer}>
            {/* Barre du haut : retour + recherche + GPS */}
            <View style={s.mapTopBar}>
              <Pressable onPress={() => setStep('list')} hitSlop={12} style={s.backBtn}>
                <Feather name="arrow-left" size={20} color="#374151" />
              </Pressable>

              <View style={s.searchWrap}>
                <Feather name="search" size={14} color="#9CA3AF" style={{ marginRight: 7 }} />
                <TextInput
                  style={s.searchInput}
                  placeholder="Rechercher une adresse…"
                  placeholderTextColor="#9CA3AF"
                  value={searchQuery}
                  onChangeText={onSearchChange}
                  returnKeyType="search"
                  clearButtonMode="while-editing"
                  autoCorrect={false}
                />
                {searching && <ActivityIndicator size="small" color={P} style={{ marginLeft: 6 }} />}
              </View>

              <Pressable onPress={recenterGPS} hitSlop={12} style={s.gpsBtn}>
                <Feather name="crosshair" size={21} color={GPS_BLUE} />
              </Pressable>
            </View>

            {/* Dropdown résultats de recherche */}
            {showResults && searchResults.length > 0 && (
              <View style={s.resultsDropdown}>
                {searchResults.map(r => (
                  <Pressable
                    key={r.place_id}
                    style={s.resultRow}
                    onPress={() => onSelectResult(r)}
                  >
                    <Feather name="map-pin" size={13} color="#9CA3AF" style={{ marginRight: 8 }} />
                    <Text style={s.resultTxt} numberOfLines={2}>{r.display_name}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Carte */}
            <View style={s.mapWrap}>
              <WebView
                key={mapKey}
                ref={webviewRef}
                source={{ html: MAP_HTML(mapCenter.lat, mapCenter.lon) }}
                style={StyleSheet.absoluteFill}
                onMessage={onWebViewMessage}
                scrollEnabled={false}
                bounces={false}
                javaScriptEnabled
                originWhitelist={['*']}
              />

              {/* ── Floating pin (overlay RN, immobile au centre) ── */}
              <View style={s.floatingPinWrap} pointerEvents="none">
                <View style={s.pinCircle}>
                  <View style={s.pinDot} />
                </View>
                <View style={s.pinTip} />
                <View style={s.pinShadow} />
              </View>
            </View>

            {/* Légende + bouton "Pin ici" */}
            <View style={s.pinBtnWrap}>
              <Text style={s.pinHint}>
                Déplacez la carte pour positionner le pin, puis confirmez
              </Text>
              <TouchableOpacity style={s.pinBtn} onPress={handlePinIci} activeOpacity={0.85}>
                <Feather name="check-circle" size={17} color="#fff" style={{ marginRight: 8 }} />
                <Text style={s.pinBtnTxt}>Pin ici</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ══════════════════════════════
            FORMULAIRE
        ══════════════════════════════ */}
        {step === 'form' && (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={s.header}>
              <Pressable onPress={() => setStep('map')} hitSlop={12}>
                <Feather name="arrow-left" size={20} color="#374151" />
              </Pressable>
              <Text style={s.headerTitle}>{editingId ? 'Modifier l\'adresse' : 'Confirmer l\'adresse'}</Text>
              <View style={{ width: 22 }} />
            </View>

            <ScrollView contentContainerStyle={s.formContent} keyboardShouldPersistTaps="handled">

              {/* Mini-carte */}
              <View style={s.previewMap}>
                <WebView
                  source={{ html: MAP_HTML_STATIC(currentCenter.current.lat, currentCenter.current.lon) }}
                  style={StyleSheet.absoluteFill}
                  scrollEnabled={false}
                  javaScriptEnabled
                  originWhitelist={['*']}
                  pointerEvents="none"
                />
              </View>

              {/* Adresse géocodée — affiche "Quartier, Ville" */}
              <View style={s.resolvedBox}>
                {pinning
                  ? <ActivityIndicator color={P} style={{ marginRight: 10 }} />
                  : <Feather name="map-pin" size={16} color={P} style={{ marginRight: 10, marginTop: 2 }} />
                }
                <View style={{ flex: 1 }}>
                  {/* Ligne principale : quartier ou rue */}
                  <Text style={s.resolvedAddr}>
                    {pinning ? '…' : (mapSuburb || mapAddr || '…')}
                  </Text>
                  {/* Ville en dessous */}
                  {!pinning && mapCity ? (
                    <Text style={s.resolvedCity}>{mapCity}</Text>
                  ) : null}
                </View>
              </View>

              {/* Nom */}
              <View>
                <Text style={s.fieldLabel}>Nom de l'adresse</Text>
                <View style={s.chipRow}>
                  {LABEL_OPTIONS.map(opt => {
                    const active = label === opt.key;
                    return (
                      <Pressable
                        key={opt.key}
                        style={[s.chip, active && s.chipOn]}
                        onPress={() => setLabel(prev => prev === opt.key ? '' : opt.key)}
                      >
                        <opt.Icon color={active ? P : '#6B7280'} />
                        <Text style={[s.chipTxt, active && s.chipTxtOn]}>{opt.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TextInput
                  style={s.input}
                  placeholder="Nom personnalisé…"
                  placeholderTextColor="#9CA3AF"
                  value={label}
                  onChangeText={setLabel}
                  returnKeyType="next"
                />
              </View>

              {/* Complément */}
              <View>
                <Text style={s.fieldLabel}>Complément (optionnel)</Text>
                <TextInput
                  style={s.input}
                  placeholder="Appartement, étage, bâtiment…"
                  placeholderTextColor="#9CA3AF"
                  value={complement}
                  onChangeText={setComplement}
                  returnKeyType="next"
                />
              </View>

              {/* Code d'accès / contact à l'arrivée */}
              <View>
                <Text style={s.fieldLabel}>Code / Numéro à l'arrivée (optionnel)</Text>
                <TextInput
                  style={s.input}
                  placeholder="Code portail, interphone, tél. à appeler…"
                  placeholderTextColor="#9CA3AF"
                  value={accessCode}
                  onChangeText={setAccessCode}
                  returnKeyType="done"
                />
                <Text style={s.fieldHint}>
                  Ces infos seront incluses dans le lien partagé avec le livreur
                </Text>
              </View>

              {/* Sauvegarder localement */}
              <Pressable style={s.toggleRow} onPress={() => setSaveLocal(v => !v)}>
                <View style={[s.checkbox, saveLocal && s.checkboxOn]}>
                  {saveLocal && <Feather name="check" size={11} color="#fff" />}
                </View>
                <Text style={s.toggleTxt}>Sauvegarder dans mes adresses</Text>
              </Pressable>

              {/* Confirmer */}
              <TouchableOpacity
                style={[s.confirmBtn, (saving || pinning) && s.confirmBtnOff]}
                onPress={handleSave}
                disabled={saving || pinning}
                activeOpacity={0.85}
              >
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.confirmBtnTxt}>Confirmer l'adresse</Text>
                }
              </TouchableOpacity>

              {/* Bouton partager */}
              <TouchableOpacity
                style={s.shareBtn}
                onPress={() => shareAddr({
                  id: '',
                  label: label.trim() || displayAddress,
                  address: [mapSuburb, mapAddr, complement.trim()].filter(Boolean).join(', '),
                  city: mapCity,
                  suburb: mapSuburb || undefined,
                  lat: currentCenter.current.lat,
                  lon: currentCenter.current.lon,
                  complement: complement.trim() || undefined,
                  accessCode: accessCode.trim() || undefined,
                })}
              >
                <Feather name="share-2" size={15} color={P} style={{ marginRight: 8 }} />
                <Text style={s.shareBtnTxt}>Partager cette adresse</Text>
              </TouchableOpacity>

              {/* Ouvrir dans Maps */}
              <TouchableOpacity
                style={s.mapsRow}
                onPress={() => openInMaps(currentCenter.current.lat, currentCenter.current.lon)}
              >
                <Feather name="external-link" size={14} color="#9CA3AF" style={{ marginRight: 6 }} />
                <Text style={s.mapsTxt}>
                  {Platform.OS === 'ios' ? 'Ouvrir dans Plans' : 'Ouvrir dans Google Maps'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        )}

      </View>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Styles
═══════════════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },

  /* ── liste ── */
  listContent: { padding: 16, gap: 10, paddingBottom: 40 },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 14, borderRadius: 14, borderWidth: 1.5,
    borderStyle: 'dashed', borderColor: P, marginBottom: 4,
  },
  newBtnIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF0EB',
    alignItems: 'center', justifyContent: 'center',
  },
  newBtnTitle: { fontSize: 15, fontWeight: '700', color: P },
  newBtnSub:   { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  emptyBox:    { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24, gap: 10 },
  emptyTitle:  { fontSize: 16, fontWeight: '700', color: '#374151' },
  emptySub:    { fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 19 },
  addrCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9FAFB', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#E5E7EB', overflow: 'hidden',
  },
  addrCardActive: {
    backgroundColor: '#FFF7F4', borderColor: P,
  },
  addrMain:    { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 14 },
  addrIconWrap:{
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFF0EB',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  addrIconWrapActive: { backgroundColor: P },
  activeBadge: {
    backgroundColor: P, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  activeBadgeTxt: { fontSize: 10, fontWeight: '700', color: '#fff' },
  addrTexts:   { flex: 1 },
  addrLabel:   { fontSize: 14, fontWeight: '600', color: '#111827' },
  addrSub:     { fontSize: 12, color: '#6B7280', marginTop: 2 },
  addrActions: { flexDirection: 'row', paddingRight: 2 },
  iconBtn:     { padding: 12 },

  /* ── carte ── */
  mapContainer: { flex: 1 },
  mapTopBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 12 : 10, paddingBottom: 10,
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 3, zIndex: 20,
  },
  backBtn:  { padding: 4 },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F3F4F6', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 13, color: '#111827', padding: 0 },
  gpsBtn: { padding: 4 },

  resultsDropdown: {
    position: 'absolute', top: Platform.OS === 'ios' ? 62 : 58,
    left: 12, right: 12, zIndex: 30,
    backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 10,
  },
  resultRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F3F4F6',
  },
  resultTxt: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 18 },

  mapWrap: { flex: 1, position: 'relative' },

  /* floating pin */
  floatingPinWrap: {
    position: 'absolute', top: '50%', left: '50%',
    marginLeft: -18, marginTop: -42, // centre du cercle à 50%
    alignItems: 'center', width: 36,
  },
  pinCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: P, borderWidth: 3, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: P, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 8, elevation: 8,
  },
  pinDot:   { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
  pinTip: {
    width: 0, height: 0,
    borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8,
    borderStyle: 'solid',
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: P,
    marginTop: -1,
  },
  pinShadow: {
    width: 14, height: 5, borderRadius: 7,
    backgroundColor: 'rgba(0,0,0,0.13)', marginTop: 3,
  },

  pinBtnWrap: {
    padding: 16, paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 6,
  },
  pinHint: {
    fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginBottom: 10,
  },
  pinBtn: {
    backgroundColor: P, borderRadius: 14, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  pinBtnTxt: { fontSize: 16, fontWeight: '700', color: '#fff' },

  /* ── formulaire ── */
  formContent: { padding: 20, gap: 18, paddingBottom: 40 },
  previewMap:  { height: 150, borderRadius: 14, overflow: 'hidden', backgroundColor: '#F3F4F6' },
  resolvedBox: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#FFF7F4', borderRadius: 12,
    borderWidth: 1, borderColor: '#FFD6C4', padding: 14,
  },
  resolvedAddr: { fontSize: 15, fontWeight: '600', color: '#111827' },
  resolvedCity: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  fieldLabel:   { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  chipRow:      { flexDirection: 'row', gap: 8, marginBottom: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  chipOn:    { backgroundColor: '#FFF0EB', borderColor: P },
  chipTxt:   { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  chipTxtOn: { color: P, fontWeight: '700' },
  input: {
    backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1,
    borderColor: '#E5E7EB', paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#111827',
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#D1D5DB',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn:    { backgroundColor: P, borderColor: P },
  toggleTxt:     { fontSize: 14, color: '#374151' },
  confirmBtn:    { backgroundColor: P, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  confirmBtnOff: { opacity: 0.5 },
  confirmBtnTxt: { fontSize: 16, fontWeight: '700', color: '#fff' },
  fieldHint: { fontSize: 11, color: '#9CA3AF', marginTop: 5 },

  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: P, borderRadius: 14, paddingVertical: 13,
  },
  shareBtnTxt: { fontSize: 15, fontWeight: '600', color: P },

  mapsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8,
  },
  mapsTxt: { fontSize: 13, color: '#9CA3AF' },
});
