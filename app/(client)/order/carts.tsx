// app/(client)/order/carts.tsx
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Alert, Image, LayoutAnimation, Platform, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '@/hooks/useCart';
import { formatPrice } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────────
type HourRow = {
  day_of_week: string;
  open_time:   string;
  close_time:  string;
  is_closed:   boolean;
};

type ZoneRow = {
  id:    string;
  label: string;
  price: number | null;
};

type UserLocation = {
  delivery_address: string | null;
  delivery_city:    string | null;
  delivery_lat:     number | null;
  delivery_lon:     number | null;
};

type DeliveryCheck = {
  available: boolean;
  zone:      ZoneRow | null;
};

// ── Helpers jours de la semaine ────────────────────────────────────────────────
const DAY_KEYS    = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const DAY_FULL_FR = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];

/**
 * Normalise un nom de jour : gère à la fois l'anglais ET le français
 * (le champ day_of_week en base peut être stocké dans l'une ou l'autre langue)
 *
 *   "Vendredi" → "friday"
 *   "friday"   → "friday"
 *   "LUNDI"    → "monday"
 */
const FR_TO_EN: Record<string, string> = {
  // Français complet
  lundi: 'monday', mardi: 'tuesday', mercredi: 'wednesday',
  jeudi: 'thursday', vendredi: 'friday', samedi: 'saturday',
  dimanche: 'sunday',
  // Abréviations anglaises (Mon, Tue, Wed…)
  mon: 'monday', tue: 'tuesday', wed: 'wednesday',
  thu: 'thursday', fri: 'friday', sat: 'saturday', sun: 'sunday',
};
function normDay(d: string): string {
  const lower = d.toLowerCase().trim();
  return FR_TO_EN[lower] ?? lower; // si déjà en anglais, le retourne tel quel
}

// ── Helpers géographiques ──────────────────────────────────────────────────────
const ADDRESS_SPECIFICITY = [
  'neighbourhood', 'quarter', 'suburb', 'city_district', 'district',
  'city', 'town', 'municipality', 'village', 'hamlet',
  'county', 'state_district', 'state',
] as const;

const normalize = (s: string) =>
  s.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');

function labelsMatch(zoneLabel: string, addressValue: string): boolean {
  const z = normalize(zoneLabel);
  const a = normalize(addressValue);
  return z === a || z.includes(a) || a.includes(z);
}

async function resolveDeliveryZone(
  zones:    ZoneRow[],
  userLat:  number,
  userLon:  number,
  cityHint: string | null,
): Promise<DeliveryCheck> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${userLat}&lon=${userLon}&format=json&accept-language=fr`;
    const res  = await fetch(url, { headers: { 'User-Agent': 'BymohApp/1.0 contact@bymoh.com' } });
    const data = await res.json();
    const addr = (data?.address ?? {}) as Record<string, string>;
    for (const key of ADDRESS_SPECIFICITY) {
      const val = addr[key];
      if (!val) continue;
      const match = zones.find(z => labelsMatch(z.label, val));
      if (match) return { available: true, zone: match };
    }
  } catch {
    // Nominatim injoignable → fallback texte
  }
  if (cityHint) {
    const match = zones.find(z => labelsMatch(z.label, cityHint));
    if (match) return { available: true, zone: match };
  }
  return { available: false, zone: null };
}

// ── Helpers horaires ───────────────────────────────────────────────────────────
function currentTimeInTZ(tz: string): { dayIndex: number; timeStr: string } {
  const now   = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);

  const weekday = parts.find(p => p.type === 'weekday')?.value?.toLowerCase() ?? '';
  let   hour    = parts.find(p => p.type === 'hour')?.value   ?? '00';
  const minute  = parts.find(p => p.type === 'minute')?.value ?? '00';
  if (hour === '24') hour = '00';

  const timeStr  = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  const dayIndex = DAY_KEYS.indexOf(weekday);
  return { dayIndex: dayIndex === -1 ? new Date().getDay() : dayIndex, timeStr };
}

function getClosedStatus(
  biz:   any,
  hours: HourRow[],
): { closed: boolean; nextOpen: string | null } {
  const tz = biz?.timezone || 'Africa/Lome';
  const { dayIndex, timeStr } = currentTimeInTZ(tz);
  const todayKey = DAY_KEYS[dayIndex];

  // ── Recherche du créneau d'aujourd'hui ──────────────────────────────────────
  // normDay() gère français ET anglais (ex : "vendredi" → "friday")
  const todayRow = hours.find(h => normDay(h.day_of_week) === todayKey);

  if (todayRow) {
    if (todayRow.is_closed) {
      // Jour marqué fermé → chercher le prochain jour ouvert
    } else {
      if (timeStr < todayRow.open_time)  return { closed: true,  nextOpen: `aujourd'hui à ${todayRow.open_time}` };
      if (timeStr < todayRow.close_time) return { closed: false, nextOpen: null };
      // Passé la fermeture → chercher demain
    }
  } else {
    // Pas de ligne pour aujourd'hui → fallback sur les champs directs de la boutique
    const openH  = biz?.open_hour  ?? '08:00';
    const closeH = biz?.close_hour ?? '18:00';

    // IMPORTANT : on traite is_open === null comme "potentiellement ouvert"
    // (seul un false explicite ferme sans vérifier les horaires)
    if (biz?.is_open !== false) {
      if (timeStr < openH)  return { closed: true,  nextOpen: `aujourd'hui à ${openH}` };
      if (timeStr < closeH) return { closed: false, nextOpen: null };
      // Passé l'heure → chercher demain via la boucle ci-dessous
    } else {
      // is_open === false mais on cherche quand même la prochaine ouverture
      // (le marchand a peut-être un planning futur)
    }
  }

  // ── Prochain créneau ouvert (7 prochains jours) ────────────────────────────
  for (let offset = 1; offset <= 7; offset++) {
    const nextIdx = (dayIndex + offset) % 7;
    const nextKey = DAY_KEYS[nextIdx];
    const row     = hours.find(h => normDay(h.day_of_week) === nextKey);

    if (row) {
      if (!row.is_closed) {
        const label = offset === 1
          ? `demain à ${row.open_time}`
          : `${DAY_FULL_FR[nextIdx]} à ${row.open_time}`;
        return { closed: true, nextOpen: label };
      }
    } else {
      // Pas de ligne pour ce jour → si la boutique utilise des horaires fixes
      if (biz?.is_open !== false) {
        const fallback = biz?.open_hour ?? '08:00';
        const label    = offset === 1
          ? `demain à ${fallback}`
          : `${DAY_FULL_FR[nextIdx]} à ${fallback}`;
        return { closed: true, nextOpen: label };
      }
    }
  }

  return { closed: true, nextOpen: null };
}

/** Parse delivery_address : JSON {label, city, ...} ou chaîne brute */
function parseAddress(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const p     = JSON.parse(raw);
    const parts = [p.label ?? p.name ?? p.title, p.city].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : String(raw);
  } catch {
    return raw;
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// ⚠️  NOM DE TABLE PROFILS
//
// Si vous voyez une erreur 404 sur /rest/v1/profiles dans les logs Supabase,
// c'est que la table des profils ne s'appelle pas "profiles" dans votre projet.
// Cherchez le nom réel (ex : "users") et remplacez PROFILE_TABLE ci-dessous.
// ────────────────────────────────────────────────────────────────────────────────
const PROFILE_TABLE = 'users';

// ── Écran ──────────────────────────────────────────────────────────────────────
export default function CartsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top + 8;
  const botPad = Platform.OS === 'ios' ? insets.bottom + 20 : 20;

  const {
    items, businessId: storeBusinessId, businessName,
    totalItems, totalAmount, clearCart,
  } = useCart();
  const queryClient = useQueryClient();

  const businessId = storeBusinessId || (items[0] as any)?.business_id || null;

  // ── Infos boutique ──────────────────────────────────────────────────────────
  const { data: biz } = useQuery({
    queryKey: ['carts-biz', businessId],
    queryFn: async () => {
      if (!businessId) return null;
      const { data, error } = await supabase
        .from('businesses')
        .select('id, name, cover_url, is_active, has_delivery, timezone, city, is_open, open_hour, close_hour, latitude, longitude')
        .eq('id', businessId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!businessId,
    staleTime: 30_000,
  });

  // ── Horaires ────────────────────────────────────────────────────────────────
  const { data: businessHours = [] } = useQuery<HourRow[]>({
    queryKey: ['carts-hours', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data } = await supabase
        .from('business_hours')
        .select('day_of_week, open_time, close_time, is_closed')
        .eq('business_id', businessId);
      return (data as HourRow[]) ?? [];
    },
    enabled: !!businessId,
    staleTime: 5 * 60_000,
  });

  // ── Localisation du client ──────────────────────────────────────────────────
  const { data: userLocation } = useQuery<UserLocation>({
    queryKey: ['user-location'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { delivery_address: null, delivery_city: null, delivery_lat: null, delivery_lon: null };

      const { data, error } = await supabase
        .from(PROFILE_TABLE)
        .select('delivery_address, delivery_city, delivery_lat, delivery_lon')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        // Loguer pour aider au debug (visible dans la console Metro / Expo)
        console.warn('[CartsScreen] Erreur lecture profil :', error.code, error.message);
        console.warn('[CartsScreen] Vérifiez PROFILE_TABLE (actuellement :', PROFILE_TABLE, ')');
      }

      return {
        delivery_address: data?.delivery_address ?? null,
        delivery_city:    data?.delivery_city    ?? null,
        delivery_lat:     data?.delivery_lat     ?? null,
        delivery_lon:     data?.delivery_lon     ?? null,
      };
    },
    staleTime: 60_000,
  });

  // ── Vérification zone de livraison (reverse geocoding) ─────────────────────
  const deliveryEnabled =
    !!businessId &&
    biz !== undefined &&
    !!biz?.has_delivery &&
    userLocation !== undefined &&
    userLocation.delivery_lat !== null &&
    userLocation.delivery_lon !== null;

  const { data: deliveryCheck } = useQuery<DeliveryCheck>({
    queryKey: [
      'carts-delivery-check',
      businessId,
      userLocation?.delivery_lat,
      userLocation?.delivery_lon,
    ],
    queryFn: async () => {
      const { data: zones } = await supabase
        .from('delivery_zones')
        .select('id, label, price')
        .eq('business_id', businessId!);

      if (!zones || zones.length === 0) return { available: false, zone: null };

      return resolveDeliveryZone(
        zones as ZoneRow[],
        userLocation!.delivery_lat!,
        userLocation!.delivery_lon!,
        userLocation!.delivery_city,
      );
    },
    enabled: deliveryEnabled,
    staleTime: 5 * 60_000,
  });

  // ── Rafraîchissement auto ───────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['carts-biz'] });
      queryClient.invalidateQueries({ queryKey: ['carts-hours'] });
      queryClient.invalidateQueries({ queryKey: ['user-location'] });
      queryClient.invalidateQueries({ queryKey: ['carts-delivery-check'] });
    }, [queryClient]),
  );

  // ── Auto-suppression si boutique supprimée ──────────────────────────────────
  const clearedRef = useRef(false);
  useEffect(() => {
    if (biz === null && items.length > 0 && !clearedRef.current) {
      clearedRef.current = true;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      clearCart();
      Alert.alert(
        'Panier vidé',
        "La boutique n'est plus disponible. Les articles ont été retirés de votre panier.",
        [{ text: 'OK' }],
      );
    }
  }, [biz, items.length]);

  // ── Valeurs dérivées ────────────────────────────────────────────────────────
  const displayName = biz?.name ?? businessName ?? '';
  const coverUrl    = biz?.cover_url ?? null;

  const deliveryLine = (() => {
    if (!biz?.has_delivery) return null;
    if (!userLocation?.delivery_lat || !userLocation?.delivery_lon) {
      return { available: false, text: 'Configurez votre adresse pour voir la livraison' };
    }
    if (!deliveryCheck) return null; // chargement en cours
    if (deliveryCheck.available && deliveryCheck.zone) {
      const price = deliveryCheck.zone.price != null
        ? ` · ${formatPrice(deliveryCheck.zone.price)}`
        : '';
      return { available: true, text: `Livraison à : ${deliveryCheck.zone.label}${price}` };
    }
    return { available: false, text: 'Livraison non disponible à votre adresse' };
  })();

  const closedStatus = useMemo(
    () => biz && businessHours.length > 0
      ? getClosedStatus(biz, businessHours)
      : { closed: false, nextOpen: null },
    [biz, businessHours],
  );

  // ── Panier vide ─────────────────────────────────────────────────────────────
  if (items.length === 0 || !businessId) {
    return (
      <View style={[s.root, { paddingTop: topPad }]}>
        <View style={s.headerRow}>
          <Text style={s.pageTitle}>Paniers</Text>
          <TouchableOpacity
            style={s.ordersBtn}
            onPress={() => router.push('/(client)/order/orders' as any)}
          >
            <Feather name="bookmark" size={15} color="#374151" />
            <Text style={s.ordersBtnText}>Commandes</Text>
          </TouchableOpacity>
        </View>
        <View style={s.empty}>
          <Feather name="shopping-cart" size={56} color="#D1D5DB" />
          <Text style={s.emptyTitle}>Aucun panier</Text>
          <Text style={s.emptyText}>
            Ajoutez des articles depuis un commerce pour commencer.
          </Text>
          <TouchableOpacity
            style={s.exploreCta}
            onPress={() => router.push('/(client)' as any)}
          >
            <Text style={s.exploreCtaText}>Explorer les commerces</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Carte boutique ──────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { paddingTop: topPad }]}>

      <View style={s.headerRow}>
        <Text style={s.pageTitle}>Paniers</Text>
        <TouchableOpacity
          style={s.ordersBtn}
          onPress={() => router.push('/(client)/order/orders' as any)}
        >
          <Feather name="bookmark" size={15} color="#374151" />
          <Text style={s.ordersBtnText}>Commandes</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: botPad }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.card}>

          <View style={s.cardTop}>

            <View style={s.logoCircle}>
              {coverUrl ? (
                <Image source={{ uri: coverUrl }} style={s.logoImg} resizeMode="cover" />
              ) : (
                <View style={s.logoPlaceholder}>
                  <Feather name="shopping-bag" size={22} color="#FF6835" />
                </View>
              )}
            </View>

            <View style={s.cardMeta}>
              <Text style={s.bizName} numberOfLines={1}>{displayName}</Text>

              <Text style={s.metaLine}>
                {totalItems} article{totalItems > 1 ? 's' : ''} · {formatPrice(totalAmount)}
              </Text>

              {deliveryLine && (
                <View style={s.infoRow}>
                  <Feather
                    name="map-pin"
                    size={11}
                    color={deliveryLine.available ? '#9CA3AF' : '#EF4444'}
                  />
                  <Text
                    style={[s.infoText, !deliveryLine.available && s.redText]}
                    numberOfLines={2}
                  >
                    {' '}{deliveryLine.text}
                  </Text>
                </View>
              )}

              {closedStatus.closed && (
                <View style={s.infoRow}>
                  <Feather name="clock" size={11} color="#EF4444" />
                  <Text style={[s.infoText, s.redText]} numberOfLines={1}>
                    {' '}Fermé
                    {closedStatus.nextOpen ? ` · Ouvre ${closedStatus.nextOpen}` : ''}
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={s.moreBtn}
              onPress={() =>
                Alert.alert('Options', '', [
                  {
                    text:  'Vider le panier',
                    style: 'destructive',
                    onPress: () => {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      clearCart();
                    },
                  },
                  { text: 'Annuler', style: 'cancel' },
                ])
              }
            >
              <Feather name="more-horizontal" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={s.viewCartBtn}
            activeOpacity={0.88}
            onPress={() =>
              router.push({ pathname: '/(client)/order/cart' as any, params: { businessId } })
            }
          >
            <Text style={s.viewCartText}>Voir le panier</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.viewStoreBtn}
            activeOpacity={0.88}
            onPress={() =>
              router.push({ pathname: '/(client)/business/[id]' as any, params: { id: businessId } })
            }
          >
            <Text style={s.viewStoreText}>Voir la boutique</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:            { flex: 1, backgroundColor: '#F8F7F4' },
  headerRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, backgroundColor: '#F8F7F4' },
  pageTitle:       { fontSize: 28, fontWeight: '800', color: '#111827' },
  ordersBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  ordersBtnText:   { fontSize: 13, fontWeight: '600', color: '#374151' },

  empty:           { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 24, paddingBottom: 80 },
  emptyTitle:      { fontSize: 22, fontWeight: '700', color: '#111827' },
  emptyText:       { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 21 },
  exploreCta:      { backgroundColor: '#FF6835', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 100 },
  exploreCtaText:  { fontSize: 15, fontWeight: '700', color: '#fff' },

  scroll:          { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  card:            { backgroundColor: '#fff', borderRadius: 20, padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 4, gap: 12 },
  cardTop:         { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },

  logoCircle:      { width: 60, height: 60, borderRadius: 30, overflow: 'hidden', backgroundColor: '#FFF3EE', alignItems: 'center', justifyContent: 'center' },
  logoImg:         { width: 60, height: 60 },
  logoPlaceholder: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFF3EE', alignItems: 'center', justifyContent: 'center' },

  cardMeta:        { flex: 1, gap: 4 },
  bizName:         { fontSize: 16, fontWeight: '700', color: '#111827' },
  metaLine:        { fontSize: 13, color: '#6B7280' },
  infoRow:         { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
  infoText:        { fontSize: 12, color: '#9CA3AF', flex: 1 },
  redText:         { color: '#EF4444' },

  moreBtn:         { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  viewCartBtn:     { backgroundColor: '#111827', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  viewCartText:    { fontSize: 15, fontWeight: '700', color: '#fff' },
  viewStoreBtn:    { backgroundColor: '#F3F4F6', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  viewStoreText:   { fontSize: 15, fontWeight: '600', color: '#374151' },
});
