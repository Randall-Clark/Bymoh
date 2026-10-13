// app/(client)/order/checkout.tsx
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/hooks/useCart';
import { useLocationStore } from '@/stores/locationStore';
import { useAuthStore } from '@/stores/authStore';
import { formatPrice } from '@/lib/utils';
import LocationPickerModal from '@/components/LocationPickerModal';

// ── Types ─────────────────────────────────────────────────────────────────────
type DeliveryMode = 'delivery' | 'pickup';
type PaymentMethod = 'mobile' | 'card' | 'cash';

interface DeliveryZone {
  id: string;
  label: string;
  price: number;
}

interface BusinessInfo {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  timezone: string | null;
  has_delivery: boolean;
  open_hour: string | null;
  close_hour: string | null;
}

// ── Timezone par pays / ville ──────────────────────────────────────────────────
function getBusinessTimezone(country?: string | null, city?: string | null): string {
  const s = ((country ?? '') + ' ' + (city ?? '')).toLowerCase();
  // UTC+1
  if (/b[eé]nin|cotonou|porto.novo|parakou/.test(s))   return 'Africa/Porto-Novo';
  if (/nigeria|lagos|abuja/.test(s))                    return 'Africa/Lagos';
  if (/camerou|douala|yaound/.test(s))                  return 'Africa/Douala';
  // UTC+0
  if (/c[oô]te.d.ivoire|abidjan|ivory/.test(s))        return 'Africa/Abidjan';
  if (/s[eé]n[eé]gal|dakar/.test(s))                   return 'Africa/Dakar';
  if (/mali|bamako/.test(s))                            return 'Africa/Bamako';
  if (/burkina|ouaga/.test(s))                          return 'Africa/Ouagadougou';
  if (/togo|lom[eé]/.test(s))                          return 'Africa/Lome';
  if (/ghana|accra/.test(s))                            return 'Africa/Accra';
  if (/guin[eé]e|conakry/.test(s))                     return 'Africa/Conakry';
  // Défaut Afrique de l'Ouest UTC+1 (Bénin)
  return 'Africa/Porto-Novo';
}

// ── Calcul dynamique si la boutique est ouverte ────────────────────────────────
function isStoreOpenNow(
  openHour: string | null,
  closeHour: string | null,
  timezone: string,
): boolean {
  if (!openHour || !closeHour) return false;
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('fr-FR', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const h = parseInt(parts.find((p) => p.type === 'hour')?.value  ?? '0', 10);
    const m = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
    const current = h * 60 + m;
    const [oh, om] = openHour.split(':').map(Number);
    const [ch, cm] = closeHour.split(':').map(Number);
    return current >= oh * 60 + om && current < ch * 60 + cm;
  } catch {
    return false;
  }
}


// ── Mini-map HTML ─────────────────────────────────────────────────────────────
function buildMapHtml(lat: number, lon: number): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body,#map{width:100%;height:100%;overflow:hidden;}
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
<script>
const map = new maplibregl.Map({
  container:'map',
  style:'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  center:[${lon},${lat}],
  zoom:14,
  interactive:false,
  attributionControl:false,
});
new maplibregl.Marker({color:'#FF6835'}).setLngLat([${lon},${lat}]).addTo(map);
</script>
</body>
</html>`;
}

// ── Payment labels ─────────────────────────────────────────────────────────────
const PAYMENT_OPTIONS: { id: PaymentMethod; label: string; icon: string; deliveryOnly?: boolean }[] = [
  { id: 'mobile', label: 'Paiement mobile', icon: 'smartphone' },
  { id: 'card',   label: 'Carte bancaire',  icon: 'credit-card' },
  { id: 'cash',   label: 'Cash à la livraison / réception', icon: 'dollar-sign' },
];

// ── Screen ────────────────────────────────────────────────────────────────────
export default function CheckoutScreen() {
  const insets      = useSafeAreaInsets();
  const topPad      = Platform.OS === 'web' ? 67 : insets.top + 8;
  const queryClient = useQueryClient();

  const { businessId: paramBizId } = useLocalSearchParams<{ businessId?: string }>();
  const { items, totalAmount, totalItems, businessName } = useCart();
  const locStore = useLocationStore() as any;
  const { profile } = useAuthStore();

  const businessId = paramBizId ?? items[0]?.business_id ?? '';

  // Actualisation au focus
  useFocusEffect(useCallback(() => {
    if (businessId) {
      queryClient.invalidateQueries({ queryKey: ['checkout-business', businessId] });
      queryClient.invalidateQueries({ queryKey: ['delivery-zones', businessId] });
    }
  }, [queryClient, businessId]));

  // ── State ──────────────────────────────────────────────────────────────────
  const [mode, setMode]               = useState<DeliveryMode>('delivery');
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod]   = useState<PaymentMethod>('mobile');
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [note, setNote]               = useState('');
  const [submitting, setSubmitting]   = useState(false);

  // ── Business query ─────────────────────────────────────────────────────────
  const { data: business, isLoading: bizLoading } = useQuery<BusinessInfo | null>({
    queryKey: ['checkout-business', businessId],
    queryFn: async () => {
      if (!businessId) return null;
      const { data } = await supabase
        .from('businesses')
        .select('id,name,address,city,country,timezone,has_delivery,open_hour,close_hour')
        .eq('id', businessId)
        .single();
      return data ?? null;
    },
    enabled: !!businessId,
    staleTime: 60_000,
  });

  // ── Delivery zones query ───────────────────────────────────────────────────
  const { data: zones = [] } = useQuery<DeliveryZone[]>({
    queryKey: ['checkout-zones', businessId],
    queryFn: async (): Promise<DeliveryZone[]> => {
      if (!businessId) return [];
      const { data } = await supabase
        .from('delivery_zones')
        .select('id,label,price')
        .eq('business_id', businessId)
        .order('created_at', { ascending: true });
      return (data ?? []) as DeliveryZone[];
    },
    enabled: !!businessId,
    staleTime: 60_000,
  });

  // Auto-sélectionne la première zone dès le chargement
  useEffect(() => {
    if (zones.length > 0 && !selectedZoneId) {
      setSelectedZoneId(zones[0].id);
    }
  }, [zones, selectedZoneId]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const bizTimezone = business
    ? (business.timezone ?? getBusinessTimezone(business.country, business.city))
    : 'Africa/Porto-Novo';
  const isOpen = isStoreOpenNow(business?.open_hour ?? null, business?.close_hour ?? null, bizTimezone);

  const hasDelivery    = zones.length > 0;
  const effectiveMode  = hasDelivery ? mode : 'pickup';
  const selectedZone   = zones.find((z) => z.id === selectedZoneId) ?? zones[0] ?? null;
  const deliveryFee    = effectiveMode === 'delivery' ? (selectedZone?.price ?? 0) : 0;
  const orderTotal     = totalAmount + deliveryFee;

  // Coordonnées : on essaie latitude/longitude directs sur le store, puis location imbriqué
  const lat: number = locStore?.latitude  ?? locStore?.location?.latitude  ?? 6.3654;
  const lon: number = locStore?.longitude ?? locStore?.location?.longitude ?? 2.4183;
  const address: string | null = locStore?.address ?? locStore?.location?.address ?? null;
  const mapHtml = useMemo(() => buildMapHtml(lat, lon), [lat, lon]);

  // Cash only available when delivery (delivery guy) OR pickup (pay in store)
  // Actually cash is always available as per spec
  const availablePayments = PAYMENT_OPTIONS;

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!profile?.id) {
      Alert.alert('Non connecté', 'Veuillez vous connecter pour passer une commande.');
      return;
    }
    if (!isOpen) {
      Alert.alert(
        'Boutique fermée',
        `Cette boutique est actuellement fermée.${business?.open_hour ? `\nElle ouvre à ${business.open_hour}.` : ''}\nVeuillez réessayer pendant les heures d'ouverture.`,
      );
      return;
    }
    if (effectiveMode === 'delivery' && !selectedZone) {
      Alert.alert('Zone manquante', 'Veuillez sélectionner une zone de livraison.');
      return;
    }

    setSubmitting(true);
    try {
      const orderPayload = {
        client_id:      profile.id,
        business_id:    businessId,
        delivery_mode:  effectiveMode,
        payment_method: paymentMethod,
        delivery_zone_id: effectiveMode === 'delivery' ? (selectedZone?.id ?? null) : null,
        delivery_fee:   deliveryFee,
        subtotal:       totalAmount,
        total:          orderTotal,
        delivery_lat:   effectiveMode === 'delivery' ? lat : null,
        delivery_lon:   effectiveMode === 'delivery' ? lon : null,
        note:           note.trim() || null,
        status:         'pending',
      };

      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert(orderPayload)
        .select()
        .single();
      if (orderErr) throw orderErr;

      // Insert order items
      const orderItems = items.map((item) => ({
        order_id:   order.id,
        service_id: item.service_id ?? item.id,
        title:      item.title,
        price:      item.price,
        quantity:   item.quantity,
      }));
      const { error: itemsErr } = await supabase.from('order_items').insert(orderItems);
      if (itemsErr) throw itemsErr;

      Alert.alert(
        'Commande envoyée ! 🎉',
        'Votre commande a bien été passée. Le commerçant va la préparer.',
        [{ text: 'OK', onPress: () => router.replace('/(client)' as any) }],
      );
    } catch (err: unknown) {
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Erreur lors de la commande.');
    } finally {
      setSubmitting(false);
    }
  }, [profile, businessId, effectiveMode, selectedZone, paymentMethod, deliveryFee, totalAmount, orderTotal, lat, lon, note, items]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (bizLoading) {
    return (
      <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FF6835" />
      </View>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Finaliser ma commande</Text>
          {businessName && <Text style={s.bizName}>{businessName}</Text>}
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Section 1 : Mode livraison / ramassage ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Mode de réception</Text>

          {!hasDelivery && (
            <View style={s.infoBanner}>
              <Feather name="info" size={15} color="#6B7280" />
              <Text style={s.infoBannerText}>
                Ce commerce ne propose pas la livraison. Vous devez récupérer votre commande en magasin.
              </Text>
            </View>
          )}

          <View style={s.toggleRow}>
            <TouchableOpacity
              style={[s.toggleBtn, effectiveMode === 'delivery' && s.toggleBtnActive, !hasDelivery && s.toggleBtnDisabled]}
              onPress={() => hasDelivery && setMode('delivery')}
              disabled={!hasDelivery}
              activeOpacity={0.8}
            >
              <Feather name="truck" size={17} color={effectiveMode === 'delivery' ? '#FF6835' : '#9CA3AF'} />
              <Text style={[s.toggleTxt, effectiveMode === 'delivery' && s.toggleTxtActive]}>Livraison</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.toggleBtn, effectiveMode === 'pickup' && s.toggleBtnActive]}
              onPress={() => setMode('pickup')}
              activeOpacity={0.8}
            >
              <Feather name="shopping-bag" size={17} color={effectiveMode === 'pickup' ? '#FF6835' : '#9CA3AF'} />
              <Text style={[s.toggleTxt, effectiveMode === 'pickup' && s.toggleTxtActive]}>Ramassage</Text>
            </TouchableOpacity>
          </View>

          {/* Pickup info */}
          {effectiveMode === 'pickup' && business && (
            <View style={s.pickupInfo}>
              <Feather name="map-pin" size={14} color="#6B7280" />
              <Text style={s.pickupInfoText}>
                {business.address ?? ''}{business.city ? `, ${business.city}` : ''}
              </Text>
            </View>
          )}

          {/* Pickup hours */}
          {effectiveMode === 'pickup' && business?.open_hour && business?.close_hour && (
            <View style={s.pickupInfo}>
              <Feather name="clock" size={14} color="#6B7280" />
              <Text style={s.pickupInfoText}>
                Ouvert {business.open_hour} – {business.close_hour}
                {isOpen ? '  · Ouvert maintenant' : '  · Fermé actuellement'}
              </Text>
            </View>
          )}
        </View>

        {/* ── Section 2 : Zone de livraison (si livraison) ── */}
        {effectiveMode === 'delivery' && zones.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Zone de livraison</Text>
            {zones.map((zone) => (
              <TouchableOpacity
                key={zone.id}
                style={[s.zoneRow, selectedZoneId === zone.id && s.zoneRowActive]}
                onPress={() => setSelectedZoneId(zone.id)}
                activeOpacity={0.8}
              >
                <View style={[s.zoneRadio, selectedZoneId === zone.id && s.zoneRadioActive]}>
                  {selectedZoneId === zone.id && <View style={s.zoneRadioDot} />}
                </View>
                <Text style={[s.zoneName, selectedZoneId === zone.id && s.zoneNameActive]}>{zone.label}</Text>
                <Text style={[s.zonePrice, selectedZoneId === zone.id && s.zonePriceActive]}>
                  {zone.price === 0 ? 'Gratuit' : `+${formatPrice(zone.price)}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Section 3 : Position de livraison (si livraison) ── */}
        {effectiveMode === 'delivery' && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Adresse de livraison</Text>

            {/* Mini-map */}
            <View style={s.mapContainer}>
              <WebView
                source={{ html: mapHtml }}
                style={s.map}
                scrollEnabled={false}
                pointerEvents="none"
                javaScriptEnabled
              />
              <TouchableOpacity
                style={s.mapOverlayBtn}
                onPress={() => setShowLocationPicker(true)}
                activeOpacity={0.85}
              >
                <Feather name="edit-2" size={14} color="#fff" />
                <Text style={s.mapOverlayTxt}>Modifier le pin</Text>
              </TouchableOpacity>
            </View>

            {address && (
              <View style={s.addressRow}>
                <Feather name="map-pin" size={14} color="#FF6835" />
                <Text style={s.addressText} numberOfLines={2}>{address}</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Section 4 : Résumé panier ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Résumé de la commande</Text>

          {items.map((item) => (
            <View key={item.service_id ?? item.id} style={s.orderItemRow}>
              <Text style={s.orderItemQty}>{item.quantity}×</Text>
              <Text style={s.orderItemTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={s.orderItemPrice}>{formatPrice(item.price * item.quantity)}</Text>
            </View>
          ))}

          <View style={s.divider} />

          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>Sous-total ({totalItems} article{totalItems > 1 ? 's' : ''})</Text>
            <Text style={s.summaryValue}>{formatPrice(totalAmount)}</Text>
          </View>

          {effectiveMode === 'delivery' && (
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>
                Frais de livraison{selectedZone ? ` (${selectedZone.label})` : ''}
              </Text>
              <Text style={s.summaryValue}>
                {deliveryFee === 0 ? 'Gratuit' : formatPrice(deliveryFee)}
              </Text>
            </View>
          )}

          <View style={[s.summaryRow, s.totalRow]}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalValue}>{formatPrice(orderTotal)}</Text>
          </View>
        </View>

        {/* ── Section 5 : Paiement ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Mode de paiement</Text>

          {effectiveMode === 'pickup' && (
            <View style={s.infoBanner}>
              <Feather name="info" size={15} color="#6B7280" />
              <Text style={s.infoBannerText}>
                Pour un ramassage en magasin, le paiement se fait via l'application (carte ou mobile) ou en espèces sur place.
              </Text>
            </View>
          )}
          {effectiveMode === 'delivery' && (
            <View style={s.infoBanner}>
              <Feather name="info" size={15} color="#6B7280" />
              <Text style={s.infoBannerText}>
                Le cash à la livraison est disponible. Le livreur collecte le montant à la réception.
              </Text>
            </View>
          )}

          {availablePayments.map((pm) => (
            <TouchableOpacity
              key={pm.id}
              style={[s.paymentRow, paymentMethod === pm.id && s.paymentRowActive]}
              onPress={() => setPaymentMethod(pm.id)}
              activeOpacity={0.8}
            >
              <View style={[s.paymentIcon, paymentMethod === pm.id && s.paymentIconActive]}>
                <Feather name={pm.icon as any} size={18} color={paymentMethod === pm.id ? '#FF6835' : '#6B7280'} />
              </View>
              <Text style={[s.paymentLabel, paymentMethod === pm.id && s.paymentLabelActive]}>{pm.label}</Text>
              {paymentMethod === pm.id && (
                <Feather name="check-circle" size={18} color="#FF6835" />
              )}
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>

      {/* ── Footer : Bouton commander ── */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        {!isOpen && !bizLoading && (
          <View style={s.closedFooterBanner}>
            <Feather name="clock" size={14} color="#fff" />
            <Text style={s.closedFooterText}>
              Boutique fermée — commande indisponible
              {business?.open_hour ? ` · Ouvre à ${business.open_hour}` : ''}
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={[s.orderBtn, (submitting || !isOpen) && s.orderBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting || !isOpen}
          activeOpacity={(submitting || !isOpen) ? 1 : 0.88}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : !isOpen ? (
            <Text style={s.orderBtnText}>Boutique fermée</Text>
          ) : (
            <>
              <Text style={s.orderBtnText}>Commander · {formatPrice(orderTotal)}</Text>
              <Feather name="arrow-right" size={18} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Location picker modal */}
      {showLocationPicker && (
        <LocationPickerModal
          visible={showLocationPicker}
          onClose={() => setShowLocationPicker(false)}
        />
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#F8F7F4' },
  header:  {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', paddingHorizontal: 20, paddingBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 4,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title:   { fontSize: 20, fontWeight: '800', color: '#111827' },
  bizName: { fontSize: 13, color: '#9CA3AF', marginTop: 1 },

  scroll:   { flex: 1 },
  content:  { paddingHorizontal: 16, paddingTop: 16, gap: 16 },

  section: {
    backgroundColor: '#fff', borderRadius: 18, padding: 18,
    gap: 12, borderWidth: 1, borderColor: '#ECECE8',
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },

  // Info banner
  infoBanner: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: '#F3F4F6', borderRadius: 10, padding: 12,
  },
  infoBannerText: { flex: 1, fontSize: 13, color: '#6B7280', lineHeight: 18 },

  // Toggle
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB',
  },
  toggleBtnActive:   { borderColor: '#FF6835', backgroundColor: '#FEF2EC' },
  toggleBtnDisabled: { opacity: 0.4 },
  toggleTxt:         { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  toggleTxtActive:   { color: '#FF6835' },

  // Pickup info
  pickupInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  pickupInfoText: { flex: 1, fontSize: 13, color: '#6B7280', lineHeight: 18 },

  // Zones
  zoneRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FAFAFA',
  },
  zoneRowActive: { borderColor: '#FF6835', backgroundColor: '#FEF2EC' },
  zoneRadio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center',
  },
  zoneRadioActive: { borderColor: '#FF6835' },
  zoneRadioDot:    { width: 9, height: 9, borderRadius: 5, backgroundColor: '#FF6835' },
  zoneName:        { flex: 1, fontSize: 14, fontWeight: '600', color: '#374151' },
  zoneNameActive:  { color: '#FF6835' },
  zonePrice:       { fontSize: 14, fontWeight: '700', color: '#374151' },
  zonePriceActive: { color: '#FF6835' },

  // Map
  mapContainer: {
    height: 180, borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: '#E5E7EB', position: 'relative',
  },
  map:    { flex: 1 },
  mapOverlayBtn: {
    position: 'absolute', bottom: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FF6835', paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20,
  },
  mapOverlayTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
  addressRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  addressText:   { flex: 1, fontSize: 13, color: '#374151', lineHeight: 18 },

  // Order items
  orderItemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderItemQty:   { fontSize: 13, fontWeight: '700', color: '#FF6835', minWidth: 24 },
  orderItemTitle: { flex: 1, fontSize: 13, color: '#374151' },
  orderItemPrice: { fontSize: 13, fontWeight: '600', color: '#374151' },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E5E7EB', marginVertical: 2 },

  // Summary
  summaryRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel:  { fontSize: 14, color: '#6B7280' },
  summaryValue:  { fontSize: 14, fontWeight: '600', color: '#374151' },
  totalRow:      { paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB', marginTop: 4 },
  totalLabel:    { fontSize: 16, fontWeight: '700', color: '#111827' },
  totalValue:    { fontSize: 18, fontWeight: '800', color: '#FF6835' },

  // Payment
  paymentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FAFAFA',
  },
  paymentRowActive: { borderColor: '#FF6835', backgroundColor: '#FEF2EC' },
  paymentIcon:       { width: 38, height: 38, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  paymentIconActive: { backgroundColor: '#FDDDD0' },
  paymentLabel:      { flex: 1, fontSize: 14, fontWeight: '600', color: '#374151' },
  paymentLabelActive:{ color: '#FF6835' },

  // Footer
  footer: {
    backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 10,
  },
  orderBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: '#FF6835', padding: 16, borderRadius: 14,
  },
  orderBtnDisabled:    { backgroundColor: '#9CA3AF' },
  orderBtnText:        { fontSize: 16, fontWeight: '700', color: '#fff' },
  closedFooterBanner:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EF4444', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10 },
  closedFooterText:    { flex: 1, fontSize: 13, fontWeight: '600', color: '#fff' },
});
