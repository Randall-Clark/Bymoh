// app/(client)/article/[id].tsx
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, Dimensions, Image, Platform, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCartStore } from '@/stores/cartStore';
import { TAB_BAR_HEIGHT } from '../_layout';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function fmtPrice(price: number, billing: string, unit?: string): string {
  if (billing === 'free')     return 'Gratuit';
  if (billing === 'quote')    return 'Sur devis';
  const p = (price ?? 0).toLocaleString('fr-FR');
  if (billing === 'hourly')   return `${p} FCFA / h`;
  if (billing === 'per_day')  return `${p} FCFA / j`;
  if (billing === 'per_unit') return `${p} FCFA / ${unit ?? 'u'}`;
  return `${p} FCFA`;
}

const { width: W } = Dimensions.get('window');
const IMG_H = W * 0.88;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ArticleDetailPage() {
  const insets = useSafeAreaInsets();
  const { id, businessId } = useLocalSearchParams<{ id: string; businessId: string }>();

  const cartStore = useCartStore() as any;
  const cartItems = cartStore.items ?? [];
  const getQty    = (itemId: string) =>
    cartItems.find((i: any) => i.id === itemId || i.service_id === itemId)?.quantity ?? 0;

  const [activeImg, setActiveImg] = useState(0);

  const { data: item, isLoading } = useQuery({
    queryKey: ['article', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*, business:businesses(name, phone)')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading || !item) {
    return <View style={s.center}><ActivityIndicator color="#FF6835" size="large" /></View>;
  }

  const allImgs: string[] = [
    ...(safeFirstUrl(item.image_url) ? [safeFirstUrl(item.image_url)!] : []),
    ...safeUrls(item.image_urls).filter((u: string) => u !== safeFirstUrl(item.image_url)),
  ];

  const qty        = getQty(item.id);
  const stock      = item.stock_quantity ?? item.stock ?? Infinity;
  const outOfStock = stock !== Infinity && stock <= 0;
  const atMax      = stock !== Infinity && qty >= stock;
  const priceLabel = fmtPrice(item.price, item.billing_type, item.unit);
  const showPrice  = item.billing_type !== 'free' && item.billing_type !== 'quote' && item.price > 0;

  // Barre du bas : positionnée au-dessus de la tab bar + barre gesture Android
  const bottomOffset = TAB_BAR_HEIGHT + insets.bottom;

  // Hauteur approximative de la barre d'action pour le padding du scroll
  const actionBarH = (qty > 0 ? 130 : 70) + 24; // contenu + paddings

  // Retour
  const goBack = () => {
  if (businessId) {
    router.replace({ pathname: '/(client)/business/[id]' as any, params: { id: businessId } });
  } else {
    router.replace('/(client)/' as any);
  }
};
  // Panier
  const handleAdd = () => {
    if (outOfStock || atMax) return;
    cartStore.addItem(
      {
        id:             item.id,
        title:          item.title,
        price:          item.price ?? 0,
        image_url:      allImgs[0] ?? undefined,
        allows_booking: false,
        is_available:   true,
        show_stock:     false,
        currency:       'XOF',
        kind:           item.kind,
      },
      businessId!,
      item.business?.name ?? '',
    );
  };

  const handleDecrement = () => {
    if (qty <= 1) cartStore.removeItem(item.id);
    else cartStore.updateQuantity(item.id, qty - 1);
  };

  const backBtnTop = Platform.OS === 'ios' ? insets.top + 10 : 44;

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>

      {/* ── Bouton retour ── */}
      <TouchableOpacity style={[s.backBtn, { top: backBtnTop }]} onPress={goBack}>
        <Feather name="arrow-left" size={20} color="#111827" />
      </TouchableOpacity>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomOffset + actionBarH }}
      >
        {/* ── Galerie ── */}
        <View style={[s.galleryWrap, { height: allImgs.length === 0 ? IMG_H * 0.65 : IMG_H }]}>
          {allImgs.length === 0 ? (
            <View style={[s.imgPlaceholder, { height: IMG_H * 0.65 }]}>
              <Text style={{ fontSize: 64 }}>📦</Text>
            </View>
          ) : (
            <>
              <ScrollView
                horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                style={{ width: W, height: IMG_H }}
                onMomentumScrollEnd={(e) => {
                  setActiveImg(Math.round(e.nativeEvent.contentOffset.x / W));
                }}
              >
                {allImgs.map((uri, i) => (
                  <Image key={i} source={{ uri }}
                    style={{ width: W, height: IMG_H, resizeMode: 'cover' }} />
                ))}
              </ScrollView>
              {allImgs.length > 1 && (
                <View style={s.dots}>
                  {allImgs.map((_, i) => (
                    <View key={i} style={[s.dot, i === activeImg && s.dotActive]} />
                  ))}
                </View>
              )}
              {allImgs.length > 1 && (
                <View style={s.imgCounter}>
                  <Text style={s.imgCounterTxt}>{activeImg + 1} / {allImgs.length}</Text>
                </View>
              )}
              {item.promo_active && (
                <View style={s.promoBadge}>
                  <Feather name="tag" size={11} color="#fff" />
                  <Text style={s.promoBadgeTxt}>Promo</Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* ── Infos ── */}
        <View style={s.infoBlock}>

          {/* Nom + badge rupture */}
          <View style={s.nameRow}>
            <Text style={s.name}>{item.title}</Text>
            {outOfStock && (
              <View style={s.stockBadge}>
                <Text style={s.stockBadgeTxt}>Rupture</Text>
              </View>
            )}
          </View>

          {/* ── Nom de la boutique juste sous le titre ── */}
          {item.business?.name && (
            <TouchableOpacity
              style={s.bizInline}
              onPress={() => businessId && router.push({
                pathname: '/(client)/business/[id]' as any,
                params: { id: businessId },
              })}
              activeOpacity={0.7}
            >
              <Feather name="briefcase" size={13} color="#FF6835" />
              <Text style={s.bizInlineTxt}>{item.business.name}</Text>
              <Feather name="chevron-right" size={13} color="#9CA3AF" />
            </TouchableOpacity>
          )}

          {/* Stock restant */}
          {item.show_stock && stock !== Infinity && stock > 0 && (
            <View style={s.stockRow}>
              <Feather name="package" size={13} color="#6B7280" />
              <Text style={s.stockTxt}>
                {stock} {stock > 1 ? 'disponibles' : 'disponible'}
              </Text>
            </View>
          )}

          <View style={s.divider} />

          {/* Description */}
          {item.description ? (
            <View style={s.descBlock}>
              <Text style={s.descLabel}>Description</Text>
              <Text style={s.desc}>{item.description}</Text>
            </View>
          ) : (
            <Text style={s.noDesc}>Aucune description disponible.</Text>
          )}
        </View>
      </ScrollView>

      {/* ══ BARRE D'ACTION — positionnée au-dessus de la tab bar ET de la barre gesture ══ */}
      <View style={[s.bottomBar, { bottom: bottomOffset }]}>

        {outOfStock ? (
          <View style={[s.mainBtn, s.mainBtnDisabled]}>
            <Text style={[s.mainBtnTxt, { color: '#9CA3AF' }]}>Rupture de stock</Text>
          </View>

        ) : qty === 0 ? (
          /* Premier ajout */
          <TouchableOpacity style={s.mainBtn} onPress={handleAdd} activeOpacity={0.85}>
            <Feather name="shopping-cart" size={18} color="#fff" />
            <Text style={s.mainBtnTxt}>
              Ajouter au panier{showPrice ? `  ·  ${priceLabel}` : ''}
            </Text>
          </TouchableOpacity>

        ) : (
          /* Déjà dans le panier */
          <View style={{ gap: 10 }}>
            <View style={s.qtyRow}>
              <TouchableOpacity style={s.qtyMinus} onPress={handleDecrement} activeOpacity={0.8}>
                <Feather name="minus" size={18} color="#FF6835" />
              </TouchableOpacity>
              <View style={s.qtyValWrap}>
                <Text style={s.qtyVal}>{qty}</Text>
                <Text style={s.qtyUnit}>dans le panier</Text>
              </View>
              <TouchableOpacity
                style={[s.qtyPlus, atMax && s.qtyPlusDisabled]}
                onPress={handleAdd}
                disabled={atMax}
                activeOpacity={atMax ? 1 : 0.8}
              >
                <Feather name="plus" size={18} color={atMax ? '#9CA3AF' : '#fff'} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={s.cartBtn}
              onPress={() => router.push('/(client)/order/carts' as any)}
              activeOpacity={0.85}
            >
              <Text style={s.cartBtnTxt}>Accéder au panier</Text>
              <Feather name="arrow-right" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  backBtn: {
    position: 'absolute', left: 14, zIndex: 30,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 6,
  },

  galleryWrap:     { width: W, backgroundColor: '#F3F4F6', position: 'relative' },
  imgPlaceholder:  { width: W, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  dots:            { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot:             { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive:       { backgroundColor: '#fff', width: 18 },
  imgCounter:      { position: 'absolute', bottom: 12, right: 14, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  imgCounterTxt:   { fontSize: 12, fontWeight: '600', color: '#fff' },
  promoBadge:      { position: 'absolute', top: 14, left: 14, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EF4444', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5 },
  promoBadgeTxt:   { fontSize: 12, fontWeight: '700', color: '#fff' },

  infoBlock: { padding: 20, gap: 10 },

  nameRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  name:         { fontSize: 22, fontWeight: '800', color: '#111827', flex: 1, lineHeight: 28 },
  stockBadge:   { backgroundColor: '#FEF2F2', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  stockBadgeTxt:{ fontSize: 12, fontWeight: '700', color: '#EF4444' },

  // Nom boutique inline (juste sous le titre)
  bizInline:    { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  bizInlineTxt: { fontSize: 13, fontWeight: '600', color: '#FF6835' },

  stockRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stockTxt:  { fontSize: 13, color: '#6B7280' },
  divider:   { height: 1, backgroundColor: '#F3F4F6', marginVertical: 4 },
  descBlock: { gap: 8 },
  descLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },
  desc:      { fontSize: 15, color: '#374151', lineHeight: 24 },
  noDesc:    { fontSize: 14, color: '#9CA3AF', fontStyle: 'italic' },

  // Barre d'action fixe
  bottomBar: {
    position: 'absolute', left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14,
  },

  mainBtn:         { height: 54, backgroundColor: '#FF6835', borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  mainBtnDisabled: { backgroundColor: '#F3F4F6' },
  mainBtnTxt:      { fontSize: 15, fontWeight: '800', color: '#fff' },

  qtyRow:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qtyMinus:        { width: 48, height: 48, borderRadius: 14, backgroundColor: '#FEF2EC', borderWidth: 1.5, borderColor: '#FF6835', alignItems: 'center', justifyContent: 'center' },
  qtyValWrap:      { alignItems: 'center' },
  qtyVal:          { fontSize: 22, fontWeight: '800', color: '#111827' },
  qtyUnit:         { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  qtyPlus:         { width: 48, height: 48, borderRadius: 14, backgroundColor: '#FF6835', alignItems: 'center', justifyContent: 'center' },
  qtyPlusDisabled: { backgroundColor: '#E5E7EB' },

  cartBtn:    { height: 50, backgroundColor: '#111827', borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  cartBtnTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
