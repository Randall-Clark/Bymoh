// app/(client)/business/[id].tsx
import { Feather, Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, Dimensions, FlatList, Image, Linking, Modal,
  Platform, ScrollView, Share, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { isBusinessOpen } from '@/lib/utils';
import { useCartStore } from '@/stores/cartStore';
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ItemImages = React.memo(function ItemImages({ item }: { item: any }) {
  const allUrls = [
    ...(safeFirstUrl(item.image_url) ? [safeFirstUrl(item.image_url)!] : []),
    ...safeUrls(item.image_urls).filter((u: string) => u !== safeFirstUrl(item.image_url)),
  ];
  if (allUrls.length === 0) return (
    <View style={{ width: 90, height: 90, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', borderRadius: 10 }}>
      <Text style={{ fontSize: 26 }}>{item.kind === 'article' ? '📦' : '🛎️'}</Text>
    </View>
  );
  return (
    <View style={{ position: 'relative', width: 90, height: 90 }}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        style={{ width: 90, height: 90 }} scrollEnabled={allUrls.length > 1}>
        {allUrls.map((url: string, i: number) => (
          <Image key={i} source={{ uri: url ?? undefined }}
            style={{ width: 90, height: 90, borderRadius: 10, resizeMode: 'cover' }} onError={() => {}} />
        ))}
      </ScrollView>
      {allUrls.length > 1 && (
        <View style={{ position: 'absolute', bottom: 4, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 3 }}>
          {allUrls.map((_: string, i: number) => (
            <View key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.85)' }} />
          ))}
        </View>
      )}
    </View>
  );
});

function safeFirstUrl(raw: any): string | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    if (raw.startsWith('[')) {
      try { const arr = JSON.parse(raw); return Array.isArray(arr) ? arr[0] ?? null : null; }
      catch { return null; }
    }
    return raw;
  }
  if (Array.isArray(raw)) return raw[0] ?? null;
  return null;
}

function safeUrls(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { const r = JSON.parse(raw); return Array.isArray(r) ? r : []; } catch { return []; }
}

function fmtPrice(price: number, billing: string, unit?: string) {
  if (billing === 'free')     return 'Gratuit';
  if (billing === 'quote')    return 'Sur devis';
  const p = (price ?? 0).toLocaleString('fr-FR');
  if (billing === 'hourly')   return `${p} FCFA / h`;
  if (billing === 'per_day')  return `${p} FCFA / j`;
  if (billing === 'per_unit') return `${p} FCFA / ${unit ?? 'u'}`;
  return `${p} FCFA`;
}

const DAY_FR: Record<string, string> = {
  Mon: 'Lundi', Tue: 'Mardi', Wed: 'Mercredi',
  Thu: 'Jeudi', Fri: 'Vendredi', Sat: 'Samedi', Sun: 'Dimanche',
};

const { width: W } = Dimensions.get('window');
const COL_W = (W - 16 * 2 - 14) / 2;

// ─── Page principale ──────────────────────────────────────────────────────────

export default function ClientBusinessPage() {
  const insets  = useSafeAreaInsets();
  const { id }  = useLocalSearchParams<{ id: string }>();

  const cartStore  = useCartStore() as any;
  const cartItems  = cartStore.items ?? [];

  const getItemQty = (itemId: string) =>
    cartItems.find((i: any) => i.id === itemId || i.service_id === itemId)?.quantity ?? 0;

  const totalItems = cartItems.reduce((acc: number, i: any) => acc + (i.quantity ?? 0), 0);

  const [deliveryMode, setDeliveryMode] = useState<'pickup' | 'delivery'>('pickup');
  const [searchQuery,  setSearchQuery]  = useState('');
  const [aboutVisible, setAboutVisible] = useState(false);
  const [menuVisible,  setMenuVisible]  = useState(false);

  const topOverlay = (Platform.OS === 'ios' ? insets.top : 0) + 50;
  const botPad     = Math.max(insets.bottom, 16);

  // ── Cœur favori : Zustand = source de vérité, Supabase = persistance ──────
  // Aucun useEffect / useFocusEffect qui relirait Supabase ici.
  // Tous les appels transitent par le hook → Zustand est toujours à jour.
  const { isFav: isFavorite, toggle: toggleFavorite } = useFavoriteToggle(id ?? '');

  // ── Requête boutique ──────────────────────────────────────────────────────
  const { data: business, isLoading } = useQuery({
    queryKey: ['biz-client', id],
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('*, hours:business_hours(*)')
        .eq('id', id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    refetchOnMount: 'always',
  });

  // ── Requête catalogue ─────────────────────────────────────────────────────
  const { data: catalog = [], isLoading: catLoading } = useQuery({
    queryKey: ['cat-client', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services').select('*')
        .eq('business_id', id!).eq('is_available', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
    refetchOnMount: 'always',
  });

  // ── Filtrage ──────────────────────────────────────────────────────────────
  const q = searchQuery.trim().toLowerCase();

  const services = useMemo(() =>
    catalog.filter((i: any) => i.kind === 'prestation' &&
      (!q || i.title?.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q))
    ), [catalog, q]);

  const articles = useMemo(() =>
    catalog.filter((i: any) => i.kind !== 'prestation' &&
      (!q || i.title?.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q))
    ), [catalog, q]);

  if (isLoading || !business) {
    return <View style={s.center}><ActivityIndicator color="#FF6835" size="large" /></View>;
  }

  const isOpen      = isBusinessOpen(business.hours, business.timezone);
  const tag         = (business as any).tag ?? '';
  const hasDelivery = !!business.has_delivery;
  const reviewCount = (business as any).review_count ?? null;
  const deliveryMin = (business as any).delivery_time_min ?? null;

  const subLine = [
    deliveryMin ? `${deliveryMin} min` : null,
    reviewCount ? `${reviewCount} avis` : null,
    !deliveryMin && !reviewCount && business.city ? business.city : null,
  ].filter(Boolean).join(' · ');

  // ── Panier ────────────────────────────────────────────────────────────────
  const handleAdd = (item: any) => {
    const stock = item.stock_quantity ?? item.stock ?? Infinity;
    if (stock !== Infinity && getItemQty(item.id) >= stock) return;
    cartStore.addItem(
      {
        id: item.id, title: item.title, price: item.price ?? 0,
        image_url: safeFirstUrl(item.image_url) ?? safeUrls(item.image_urls)[0] ?? undefined,
        allows_booking: false, is_available: true,
        show_stock: false, currency: 'XOF', kind: item.kind,
      },
      id!, business.name,
    );
  };

  const handleDecrement = (item: any) => {
    const qty = getItemQty(item.id);
    if (qty <= 1) cartStore.removeItem(item.id);
    else cartStore.updateQuantity(item.id, qty - 1);
  };

  // ── Carte article ─────────────────────────────────────────────────────────
  const renderArticleCard = (item: any) => {
    const qty        = getItemQty(item.id);
    const stock      = item.stock_quantity ?? item.stock ?? Infinity;
    const atMax      = stock !== Infinity && qty >= stock;
    const outOfStock = stock !== Infinity && stock <= 0;
    const imgUrl     = safeFirstUrl(item.image_url) ?? safeUrls(item.image_urls)[0];
    return (
      <TouchableOpacity
        key={item.id}
        style={[s.gridCard, { width: COL_W }]}
        activeOpacity={0.88}
        onPress={() => router.push({
          pathname: '/(client)/article/[id]' as any,
          params: { id: item.id, businessId: id },
        })}
      >
        <View>
          {imgUrl
            ? <Image source={{ uri: imgUrl }} style={s.gridImg} />
            : <View style={[s.gridImg, s.gridImgPh]}><Text style={{ fontSize: 32 }}>📦</Text></View>
          }
          {item.promo_active && (
            <View style={s.gridPromoTag}><Text style={s.gridPromoTxt}>Promo</Text></View>
          )}
          {outOfStock
            ? <View style={[s.gridAddBtn, { backgroundColor: '#E5E7EB' }]}>
                <Feather name="minus" size={16} color="#9CA3AF" />
              </View>
            : qty === 0
              ? <TouchableOpacity style={s.gridAddBtn}
                  onPress={(e) => { e.stopPropagation?.(); handleAdd(item); }} activeOpacity={0.8}>
                  <Feather name="plus" size={16} color="#fff" />
                </TouchableOpacity>
              : <View style={s.gridQtyOverlay}>
                  <TouchableOpacity style={s.gridQtyMinus}
                    onPress={(e) => { e.stopPropagation?.(); handleDecrement(item); }}>
                    <Feather name="minus" size={12} color="#FF6835" />
                  </TouchableOpacity>
                  <Text style={s.gridQtyVal}>{qty}</Text>
                  <TouchableOpacity
                    style={[s.gridQtyPlus, atMax && { backgroundColor: '#E5E7EB' }]}
                    onPress={(e) => { e.stopPropagation?.(); if (!atMax) handleAdd(item); }}
                    disabled={atMax} activeOpacity={atMax ? 1 : 0.8}>
                    <Feather name="plus" size={12} color={atMax ? '#9CA3AF' : '#fff'} />
                  </TouchableOpacity>
                </View>
          }
        </View>
        <View style={s.gridBody}>
          <Text style={s.gridTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={s.gridPrice}>{fmtPrice(item.price, item.billing_type, item.unit)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Carte service ─────────────────────────────────────────────────────────
  const renderServiceCard = ({ item }: { item: any }) => {
    const imgUrl = safeFirstUrl(item.image_url) ?? safeUrls(item.image_urls)[0];
    return (
      <TouchableOpacity style={s.serviceCard} activeOpacity={0.88}
        onPress={() => router.push({
          pathname: '/(client)/service/[id]' as any,
          params: { id: item.id, businessId: id },
        })}>
        {imgUrl
          ? <Image source={{ uri: imgUrl }} style={s.serviceImg} />
          : <View style={[s.serviceImg, s.serviceImgPh]}><Text style={{ fontSize: 28 }}>🛎️</Text></View>
        }
        <View style={s.serviceBody}>
          <View style={s.serviceTopRow}>
            <Text style={s.serviceTitle} numberOfLines={1}>{item.title}</Text>
            {item.promo_active && <Text style={s.servicePromo}>Promo</Text>}
          </View>
          <View style={s.serviceBottomRow}>
            <Text style={s.servicePrice}>{fmtPrice(item.price, item.billing_type, item.unit)}</Text>
            <TouchableOpacity style={s.serviceReserveBtn} activeOpacity={0.8}
              onPress={() => router.push({
                pathname: '/(client)/service/[id]' as any,
                params: { id: item.id, businessId: id },
              })}>
              <Text style={s.serviceReserveTxt}>Réserver</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>

      {/* COVER */}
      <View style={s.coverWrap}>
        {business.cover_url
          ? <Image source={{ uri: business.cover_url }} style={s.cover} />
          : <View style={[s.cover, s.coverPh]}>
              <Text style={{ fontSize: 64 }}>{(business as any).category_icon ?? '🏪'}</Text>
            </View>
        }
        <View style={s.coverDim} />

        <TouchableOpacity style={[s.overlayBtnAbs, { top: topOverlay, left: 14 }]} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color="#111827" />
        </TouchableOpacity>

        <View style={[s.overlayRight, { top: topOverlay }]}>
          {/* Cœur : lit isFavorite depuis Zustand via le hook */}
          <TouchableOpacity style={s.overlayBtnRow} onPress={toggleFavorite}>
            {isFavorite
              ? <Ionicons name="heart"         size={17} color="#FF6835" />
              : <Ionicons name="heart-outline" size={17} color="#111827" />
            }
          </TouchableOpacity>
          <TouchableOpacity style={s.overlayBtnRow}
            onPress={() => Share.share({
              message: `Découvrez ${business.name} sur Bymoh !${tag ? ' ' + tag : ''}\nhttps://bymoh.app/business/${id}`,
              url: `https://bymoh.app/business/${id}`,
            })}>
            <Feather name="share-2" size={17} color="#111827" />
          </TouchableOpacity>
          <TouchableOpacity style={s.overlayBtnRow} onPress={() => setMenuVisible(true)}>
            <Feather name="more-vertical" size={17} color="#111827" />
          </TouchableOpacity>
        </View>

        <View style={s.coverBottom}>
          <View style={{ gap: 3 }}>
            <View style={[s.coverBadge, isOpen ? s.coverBadgeOpen : s.coverBadgeClosed]}>
              <View style={[s.dot, { backgroundColor: isOpen ? '#22C55E' : '#9CA3AF' }]} />
              <Text style={[s.coverBadgeTxt, { color: isOpen ? '#fff' : '#E5E7EB' }]}>
                {isOpen ? 'Ouvert' : 'Fermé'}
              </Text>
            </View>
            <Text style={s.coverName} numberOfLines={1}>{business.name}</Text>
            {subLine ? <Text style={s.coverSub}>{subLine}</Text> : null}
          </View>
        </View>
      </View>

      {/* MENU POPUP */}
      {menuVisible && (
        <>
          <TouchableOpacity style={s.menuBackdrop} activeOpacity={1} onPress={() => setMenuVisible(false)} />
          <View style={[s.menuPopup, { top: topOverlay + 44 }]}>
            {([
              { icon: 'star', label: 'Laisser un avis', action: () => { setMenuVisible(false); router.push({ pathname: '/(client)/business/review' as any, params: { businessId: id, businessName: business.name } }); } },
              { icon: 'bell', label: 'Notifications',   action: () => setMenuVisible(false) },
              { icon: 'info', label: 'À propos',        action: () => { setMenuVisible(false); setAboutVisible(true); } },
            ] as const).map((it, i, arr) => (
              <React.Fragment key={it.label}>
                <TouchableOpacity style={s.menuItem} onPress={it.action}>
                  <Feather name={it.icon as any} size={16} color="#374151" />
                  <Text style={s.menuItemTxt}>{it.label}</Text>
                </TouchableOpacity>
                {i < arr.length - 1 && <View style={s.menuDiv} />}
              </React.Fragment>
            ))}
          </View>
        </>
      )}

      {/* SCROLL */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>

        <View style={s.searchWrap}>
          <Feather name="search" size={16} color="#9CA3AF" style={{ marginLeft: 14 }} />
          <TextInput
            style={s.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Rechercher dans la boutique..."
            placeholderTextColor="#9CA3AF"
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ paddingHorizontal: 12 }}>
              <Feather name="x" size={15} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        <View style={s.toggleRow}>
          <View style={[s.deliveryToggle, !hasDelivery && { opacity: 0.5 }]}>
            <TouchableOpacity
              style={[s.togglePill, deliveryMode === 'pickup' && s.toggleActive]}
              onPress={() => setDeliveryMode('pickup')} activeOpacity={0.8}>
              <Feather name="shopping-bag" size={12} color={deliveryMode === 'pickup' ? '#fff' : '#6B7280'} />
              <Text style={[s.toggleTxt, deliveryMode === 'pickup' && s.toggleTxtActive]}>Retrait</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.togglePill, deliveryMode === 'delivery' && s.toggleActive]}
              onPress={() => hasDelivery && setDeliveryMode('delivery')}
              activeOpacity={hasDelivery ? 0.8 : 1}>
              <Feather name="truck" size={12} color={deliveryMode === 'delivery' ? '#fff' : '#6B7280'} />
              <Text style={[s.toggleTxt, deliveryMode === 'delivery' && s.toggleTxtActive]}>Livraison</Text>
            </TouchableOpacity>
          </View>
        </View>

        {catLoading
          ? <ActivityIndicator color="#FF6835" style={{ marginTop: 40 }} />
          : <>
              {services.length > 0 && (
                <View style={s.section}>
                  <Text style={s.sectionTitle}>Services</Text>
                  <FlatList data={services} keyExtractor={(item: any) => item.id}
                    horizontal showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
                    renderItem={renderServiceCard} />
                </View>
              )}
              {articles.length > 0 && (
                <View style={s.section}>
                  <Text style={[s.sectionTitle, { paddingHorizontal: 16 }]}>Articles</Text>
                  <View style={s.grid}>
                    {articles.map((item: any) => renderArticleCard(item))}
                  </View>
                </View>
              )}
              {services.length === 0 && articles.length === 0 && (
                <View style={s.empty}>
                  <Feather name="package" size={40} color="#E5E7EB" />
                  <Text style={s.emptyTxt}>
                    {q ? `Aucun résultat pour « ${q} »` : 'Aucun article disponible'}
                  </Text>
                </View>
              )}
            </>
        }
      </ScrollView>

      {/* Modal À propos */}
      <Modal visible={aboutVisible} transparent animationType="slide" onRequestClose={() => setAboutVisible(false)}>
        <TouchableOpacity style={s.modalBg} activeOpacity={1} onPress={() => setAboutVisible(false)} />
        <View style={[s.modalSheet, { paddingBottom: botPad + 20 }]}>
          <View style={s.handle} />
          <Text style={s.modalTitle}>À propos</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={s.aSection}>
              <Text style={s.aSectionTitle}>Boutique</Text>
              <View style={s.aRow}>
                <Feather name="briefcase" size={15} color="#9CA3AF" />
                <Text style={s.aTxt}>{business.name}</Text>
                {tag ? <Text style={s.aTag}>{tag}</Text> : null}
              </View>
              <View style={s.aRow}>
                <Text style={{ fontSize: 15 }}>{(business as any).category_icon}</Text>
                <Text style={s.aTxt}>{business.category}</Text>
              </View>
            </View>
            {business.address
              ? <TouchableOpacity style={s.aSection} onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(business.address + ' ' + (business.city ?? ''))}`)}>
                  <Text style={s.aSectionTitle}>Adresse</Text>
                  <View style={s.aRow}>
                    <Feather name="map-pin" size={15} color="#FF6835" />
                    <Text style={[s.aTxt, { color: '#FF6835', textDecorationLine: 'underline', flex: 1 }]}>
                      {business.address}{business.city ? `, ${business.city}` : ''}
                    </Text>
                    <Feather name="external-link" size={13} color="#FF6835" />
                  </View>
                </TouchableOpacity>
              : null}
            {business.phone
              ? <TouchableOpacity style={s.aSection} onPress={() => Linking.openURL(`tel:${business.phone}`)}>
                  <Text style={s.aSectionTitle}>Téléphone</Text>
                  <View style={s.aRow}>
                    <Feather name="phone" size={15} color="#22C55E" />
                    <Text style={[s.aTxt, { color: '#22C55E', fontWeight: '600', flex: 1 }]}>{business.phone}</Text>
                    <View style={s.callPill}><Text style={s.callPillTxt}>Appeler</Text></View>
                  </View>
                </TouchableOpacity>
              : null}
            {business.description
              ? <View style={s.aSection}>
                  <Text style={s.aSectionTitle}>Description</Text>
                  <Text style={s.aDesc}>{business.description}</Text>
                </View>
              : null}
            <View style={s.aSection}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={s.aSectionTitle}>Horaires</Text>
                <View style={[s.openPill, isOpen ? s.openPillOn : s.openPillOff]}>
                  <Text style={[s.openPillTxt, { color: isOpen ? '#166534' : '#4B5563' }]}>
                    {isOpen ? 'Ouvert' : 'Fermé'}
                  </Text>
                </View>
              </View>
              {business.hours && business.hours.length > 0
                ? [...business.hours]
                    .sort((a: any, b: any) =>
                      ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].indexOf(a.day_of_week) -
                      ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].indexOf(b.day_of_week)
                    )
                    .map((h: any) => (
                      <View key={h.id ?? h.day_of_week} style={s.hRow}>
                        <Text style={s.hDay}>{DAY_FR[h.day_of_week] ?? h.day_of_week}</Text>
                        {h.is_closed
                          ? <Text style={s.hClosed}>Fermé</Text>
                          : <Text style={s.hTime}>{h.open_time} – {h.close_time}</Text>}
                      </View>
                    ))
                : <Text style={s.aDesc}>Horaires non renseignés.</Text>
              }
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  center:           { flex: 1, alignItems: 'center', justifyContent: 'center' },
  coverWrap:        { width: W, height: 240, position: 'relative' },
  cover:            { width: W, height: 240, resizeMode: 'cover' },
  coverPh:          { backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  coverDim:         { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.28)' },
  overlayBtnAbs:    { position: 'absolute', width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4 },
  overlayBtnRow:    { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4 },
  overlayRight:     { position: 'absolute', right: 14, flexDirection: 'row', gap: 7 },
  coverBottom:      { position: 'absolute', bottom: 14, left: 16, right: 14, flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  coverBadge:       { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  coverBadgeOpen:   { backgroundColor: 'rgba(34,197,94,0.82)' },
  coverBadgeClosed: { backgroundColor: 'rgba(80,80,80,0.72)' },
  coverBadgeTxt:    { fontSize: 11, fontWeight: '700' },
  dot:              { width: 5, height: 5, borderRadius: 3 },
  coverName:        { fontSize: 22, fontWeight: '800', color: '#fff', lineHeight: 26 },
  coverSub:         { fontSize: 12, color: 'rgba(255,255,255,0.72)' },
  deliveryToggle:   { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 10, borderWidth: 1.5, borderColor: '#E5E7EB', overflow: 'hidden' },
  togglePill:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6 },
  toggleActive:     { backgroundColor: '#FF6835', borderRadius: 8, margin: 2 },
  toggleTxt:        { fontSize: 11, fontWeight: '700', color: '#6B7280' },
  toggleTxtActive:  { color: '#fff' },
  menuBackdrop:     { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30 },
  menuPopup:        { position: 'absolute', right: 16, zIndex: 40, backgroundColor: '#fff', borderRadius: 14, width: 200, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.14, shadowRadius: 16, elevation: 12, overflow: 'hidden' },
  menuItem:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  menuItemTxt:      { fontSize: 14, fontWeight: '600', color: '#374151' },
  menuDiv:          { height: 1, backgroundColor: '#F3F4F6' },
  searchWrap:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginTop: 14, marginBottom: 10, borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB', height: 46 },
  searchInput:      { flex: 1, fontSize: 14, color: '#111827', paddingHorizontal: 10, height: '100%' },
  section:          { marginTop: 14, marginBottom: 4 },
  sectionTitle:     { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 12, paddingHorizontal: 16 },
  serviceCard:      { width: 260, backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#F0F0F0' },
  serviceImg:       { width: 260, height: 130, resizeMode: 'cover' },
  serviceImgPh:     { backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  serviceBody:      { padding: 10, gap: 6 },
  serviceTopRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  serviceTitle:     { fontSize: 14, fontWeight: '700', color: '#111827', flex: 1 },
  servicePromo:     { fontSize: 11, fontWeight: '700', color: '#EF4444' },
  serviceBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  servicePrice:     { fontSize: 13, fontWeight: '700', color: '#FF6835' },
  serviceReserveBtn:{ borderWidth: 1.5, borderColor: '#FF6835', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  serviceReserveTxt:{ fontSize: 12, fontWeight: '700', color: '#FF6835' },
  toggleRow:        { paddingHorizontal: 16, paddingBottom: 10, alignItems: 'flex-start' },
  grid:             { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 14 },
  gridCard:         { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#F0F0F0' },
  gridImg:          { width: '100%', height: COL_W, resizeMode: 'cover' },
  gridImgPh:        { backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  gridPromoTag:     { position: 'absolute', top: 8, left: 8, backgroundColor: '#EF4444', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  gridPromoTxt:     { fontSize: 9, fontWeight: '700', color: '#fff' },
  gridAddBtn:       { position: 'absolute', bottom: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: '#FF6835', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 4, elevation: 4 },
  gridQtyOverlay:   { position: 'absolute', bottom: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 3 },
  gridQtyMinus:     { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FEF2EC', borderWidth: 1.5, borderColor: '#FF6835', alignItems: 'center', justifyContent: 'center' },
  gridQtyPlus:      { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FF6835', alignItems: 'center', justifyContent: 'center' },
  gridQtyVal:       { fontSize: 13, fontWeight: '800', color: '#111827', minWidth: 14, textAlign: 'center' },
  gridBody:         { padding: 10, gap: 3 },
  gridTitle:        { fontSize: 13, fontWeight: '600', color: '#111827', lineHeight: 18 },
  gridPrice:        { fontSize: 13, fontWeight: '700', color: '#FF6835' },
  empty:            { alignItems: 'center', gap: 10, paddingVertical: 60 },
  emptyTxt:         { fontSize: 15, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 32 },
  modalBg:          { flex: 1, backgroundColor: 'transparent' },
  modalSheet:       { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%', gap: 14 },
  handle:           { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 4 },
  modalTitle:       { fontSize: 20, fontWeight: '800', color: '#111827' },
  aSection:         { gap: 8, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  aSectionTitle:    { fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },
  aRow:             { flexDirection: 'row', alignItems: 'center', gap: 10 },
  aTxt:             { fontSize: 15, color: '#374151' },
  aTag:             { fontSize: 12, color: '#9CA3AF' },
  aDesc:            { fontSize: 14, color: '#374151', lineHeight: 22 },
  callPill:         { backgroundColor: '#F0FDF4', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  callPillTxt:      { fontSize: 12, fontWeight: '700', color: '#22C55E' },
  openPill:         { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
  openPillOn:       { backgroundColor: '#F0FDF4' },
  openPillOff:      { backgroundColor: '#F3F4F6' },
  openPillTxt:      { fontSize: 11, fontWeight: '700' },
  hRow:             { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  hDay:             { fontSize: 14, color: '#374151', fontWeight: '500', width: 90 },
  hTime:            { fontSize: 14, color: '#22C55E', fontWeight: '600' },
  hClosed:          { fontSize: 14, color: '#9CA3AF' },
});
