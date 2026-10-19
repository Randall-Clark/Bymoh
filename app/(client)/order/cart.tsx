// app/(client)/order/cart.tsx
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Image, LayoutAnimation, Modal, Platform, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '@/hooks/useCart';
import { formatPrice } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';


export default function CartScreen() {
  const insets      = useSafeAreaInsets();
  const topPad      = Platform.OS === 'web' ? 67 : insets.top + 8;
  const TAB_BAR     = 60;
  const footerBot   = TAB_BAR + insets.bottom + 8;
  const queryClient = useQueryClient();

  const { businessId } = useLocalSearchParams<{ businessId?: string }>();

  const {
    items, businessName, totalItems, totalAmount,
    addToCart, removeFromCart, updateQuantity, clearCart,
  } = useCart();

  // Actualisation au focus : recharge les données panier / disponibilités
  useFocusEffect(useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['cart-availability'] });
  }, [queryClient]));

  const cartBusinessId = (items[0] as any)?.business_id ?? businessId ?? null;

  // ── État modal de suppression ────────────────────────────────────────────
  const [pendingDelete, setPendingDelete] = useState<any | null>(null);

  // ── Vérifie si la boutique est encore active ─────────────────────────────
  const { data: bizActive } = useQuery<boolean>({
    queryKey: ['cart-biz-active', cartBusinessId],
    queryFn: async () => {
      if (!cartBusinessId) return true;
      const { data, error } = await supabase
        .from('businesses')
        .select('is_active')
        .eq('id', cartBusinessId)
        .maybeSingle();
      if (error) throw error;
      return data === null ? false : (data.is_active ?? false);
    },
    enabled: !!cartBusinessId,
    staleTime: 30_000,
  });

  // ── Vérifie quels articles sont encore disponibles ───────────────────────
  const cartServiceIds = useMemo(
    () => items.map((i: any) => i.service_id ?? i.id).filter(Boolean),
    [items],
  );

  const { data: availableIds } = useQuery<Set<string>>({
    queryKey: ['cart-items-available', cartServiceIds.join(',')],
    queryFn: async () => {
      if (cartServiceIds.length === 0) return new Set<string>();
      const { data, error } = await supabase
        .from('services')
        .select('id')
        .in('id', cartServiceIds)
        .eq('is_available', true);
      if (error) throw error;
      return new Set((data ?? []).map((r: any) => r.id));
    },
    enabled: cartServiceIds.length > 0,
    staleTime: 30_000,
    refetchOnMount: 'always',
  });

  // ── Stock réel des articles ──────────────────────────────────────────────
  const { data: stockMap = {} } = useQuery<Record<string, number>>({
    queryKey: ['cart-stock', cartServiceIds.join(',')],
    queryFn: async () => {
      if (cartServiceIds.length === 0) return {};
      const { data, error } = await supabase
        .from('services')
        .select('id, stock_quantity, stock')
        .in('id', cartServiceIds);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of (data ?? [])) {
        const s = (row as any).stock_quantity ?? (row as any).stock;
        if (s != null) map[(row as any).id] = s;
      }
      return map;
    },
    enabled: cartServiceIds.length > 0,
    staleTime: 30_000,
    refetchOnMount: 'always',
  });

  const getStock = useCallback(
    (item: any): number => {
      const id = item.service_id ?? item.id;
      return stockMap[id] ?? Infinity;
    },
    [stockMap],
  );

  // Un article est "unavailable" si la query a terminé et son id n'y est pas
  const isUnavailable = useCallback(
    (item: any): boolean => {
      if (!availableIds) return false; // pas encore chargé → optimiste
      const id = item.service_id ?? item.id;
      return !availableIds.has(id);
    },
    [availableIds],
  );

  const hasUnavailableItems = useMemo(
    () => availableIds !== undefined && items.some((i: any) => isUnavailable(i)),
    [availableIds, items, isUnavailable],
  );

  // ── Auto-clear si boutique supprimée ────────────────────────────────────
  const clearedRef = useRef(false);
  useEffect(() => {
    if (bizActive === false && items.length > 0 && !clearedRef.current) {
      clearedRef.current = true;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      clearCart();
      Alert.alert(
        'Articles retirés',
        "La boutique n'est plus disponible. Les articles ont été retirés.",
        [{ text: 'OK' }],
      );
    }
  }, [bizActive, items.length]);

  const handleBack = useCallback(() => router.back(), []);

  const handleAddMore = useCallback(() => {
    const id = cartBusinessId;
    if (id) router.push({ pathname: '/(client)/business/[id]' as any, params: { id } });
  }, [cartBusinessId]);

  const handleAdd = useCallback((item: any) => {
    const stock = getStock(item);
    if (stock !== Infinity && item.quantity >= stock) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    addToCart(
      {
        id:             item.service_id ?? item.id,
        title:          item.title,
        price:          item.price,
        image_url:      item.image_url,
        allows_booking: false,
        is_available:   true,
        business_id:    item.business_id,
        show_stock:     false,
        currency:       'XOF',
      } as any,
      item.business_id ?? '',
      item.business_name ?? '',
    );
  }, [addToCart, getStock]);

  // Décrémente ; à 1 → ouvre le modal de confirmation
  const handleDecrement = useCallback((item: any) => {
    if (item.quantity <= 1) {
      setPendingDelete(item);
    } else {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      updateQuantity((item.service_id ?? item.id) as string, item.quantity - 1);
    }
  }, [updateQuantity]);

  const confirmDelete = useCallback(() => {
    if (!pendingDelete) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    removeFromCart((pendingDelete.service_id ?? pendingDelete.id) as string);
    setPendingDelete(null);
  }, [pendingDelete, removeFromCart]);

  // ── Panier vide ──────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <View style={[s.root, { paddingTop: topPad }]}>
        <View style={s.headerEmpty}>
          <TouchableOpacity style={s.closeBtn} onPress={handleBack}>
            <Feather name="x" size={22} color="#111827" />
          </TouchableOpacity>
        </View>
        <View style={s.emptyContent}>
          <Feather name="shopping-cart" size={56} color="#D1D5DB" />
          <Text style={s.emptyTitle}>Panier vide</Text>
          <Text style={s.emptyText}>
            Ajoutez des articles depuis un commerce pour commencer.
          </Text>
          <TouchableOpacity style={s.exploreCta} onPress={() => router.push('/(client)')}>
            <Text style={s.exploreCtaText}>Explorer les commerces</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Panier non vide ──────────────────────────────────────────────────────
  return (
    <View style={[s.root, { paddingTop: topPad }]}>

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.closeBtn} onPress={handleBack}>
          <Feather name="x" size={22} color="#111827" />
        </TouchableOpacity>

        <Text style={s.headerTitle} numberOfLines={1}>
          {businessName ?? 'Panier'}
        </Text>

        <TouchableOpacity style={s.addBtn} onPress={handleAddMore} activeOpacity={0.8}>
          <Feather name="plus" size={15} color="#111827" />
          <Text style={s.addBtnText}>Article</Text>
        </TouchableOpacity>
      </View>

      {/* ── Bannière articles indisponibles ── */}
      {hasUnavailableItems && (
        <View style={s.unavailableBanner}>
          <Feather name="alert-circle" size={15} color="#92400E" />
          <Text style={s.unavailableBannerText}>
            Certains articles ne sont plus disponibles. Retirez-les pour continuer.
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: footerBot + 80 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Liste d'articles ── */}
        <View style={s.itemsBlock}>
          {items.map((item: any, index) => {
            const unavailable = isUnavailable(item);
            return (
              <View key={item.service_id ?? item.id ?? String(index)}>
                {index > 0 && <View style={s.divider} />}
                <View style={[s.itemRow, unavailable && s.itemRowUnavailable]}>

                  {/* Image */}
                  {(() => {
                    const uri = (item as any).image_url
                      || (item as any).image
                      || (item as any).photo
                      || (item as any).thumbnail
                      || null;
                    return uri ? (
                      <View>
                        <Image source={{ uri }} style={[s.itemImg, unavailable && s.imgUnavailable]} resizeMode="cover" />
                        {unavailable && (
                          <View style={s.imgOverlay}>
                            <Feather name="slash" size={20} color="#fff" />
                          </View>
                        )}
                      </View>
                    ) : (
                      <View style={[s.itemImg, s.itemImgPlaceholder, unavailable && s.imgUnavailable]}>
                        <Text style={{ fontSize: 24 }}>📦</Text>
                      </View>
                    );
                  })()}

                  <View style={s.itemInfo}>
                    <Text style={[s.itemTitle, unavailable && s.textUnavailable]} numberOfLines={2}>
                      {item.title}
                    </Text>
                    {unavailable
                      ? <Text style={s.unavailableLabel}>Plus disponible</Text>
                      : <Text style={s.itemPrice}>{formatPrice(item.price)}</Text>
                    }
                  </View>

                  {/* Stepper ou bouton Retirer si indisponible */}
                  {unavailable ? (
                    <TouchableOpacity
                      style={s.removeBtn}
                      onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        removeFromCart((item.service_id ?? item.id) as string);
                      }}
                    >
                      <Feather name="trash-2" size={15} color="#EF4444" />
                    </TouchableOpacity>
                  ) : (
                    <View style={s.stepper}>
                      <TouchableOpacity
                        style={s.stepperBtn}
                        onPress={() => handleDecrement(item)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
                      >
                        <Feather name="minus" size={15} color="#6B7280" />
                      </TouchableOpacity>

                      <Text style={s.stepperCount}>{item.quantity}</Text>

                      {(() => {
                        const stock  = getStock(item);
                        const atMax  = stock !== Infinity && item.quantity >= stock;
                        return (
                          <TouchableOpacity
                            style={s.stepperBtn}
                            onPress={() => handleAdd(item)}
                            disabled={atMax}
                            hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                          >
                            <Feather name="plus" size={15} color={atMax ? '#D1D5DB' : '#111827'} />
                          </TouchableOpacity>
                        );
                      })()}
                    </View>
                  )}

                </View>
              </View>
            );
          })}

          {/* ── Ajouter des articles ── */}
          <View style={s.divider} />
          <TouchableOpacity style={s.addMoreRow} onPress={handleAddMore} activeOpacity={0.7}>
            <View style={s.addMoreIcon}>
              <Feather name="plus" size={16} color="#FF6835" />
            </View>
            <Text style={s.addMoreText}>Ajouter des articles</Text>
          </TouchableOpacity>
        </View>

        {/* ── Résumé commande ── */}
        <View style={s.summary}>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>
              Sous-total ({totalItems} article{totalItems > 1 ? 's' : ''})
            </Text>
            <Text style={s.summaryValue}>{formatPrice(totalAmount)}</Text>
          </View>
          <Text style={s.deliveryNote}>Les frais de livraison seront calculés à l'étape suivante.</Text>
        </View>
      </ScrollView>

      {/* ── Footer sticky ── */}
      <View style={[s.footer, { paddingBottom: footerBot }]}>
        <TouchableOpacity
          style={[s.checkoutBtn, hasUnavailableItems && s.checkoutBtnDisabled]}
          activeOpacity={hasUnavailableItems ? 1 : 0.88}
          onPress={() => {
            if (hasUnavailableItems) return;
            router.push({
              pathname: '/(client)/order/checkout' as any,
              params: { businessId: businessId ?? cartBusinessId ?? '' },
            });
          }}
        >
          <Text style={s.checkoutText}>Finaliser ma commande</Text>
        </TouchableOpacity>
      </View>

      {/* ── Modal confirmation suppression ── */}
      <Modal
        visible={!!pendingDelete}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingDelete(null)}
      >
        <View style={s.overlay}>
          <View style={s.modalCard}>
            <View style={s.modalIcon}>
              <Feather name="trash-2" size={24} color="#FF6835" />
            </View>

            <Text style={s.modalTitle}>Retirer l'article ?</Text>
            <Text style={s.modalBody} numberOfLines={2}>
              {pendingDelete?.title ?? 'Cet article'} sera retiré de votre panier.
            </Text>

            <View style={s.modalActions}>
              <TouchableOpacity
                style={s.modalCancelBtn}
                onPress={() => setPendingDelete(null)}
                activeOpacity={0.8}
              >
                <Text style={s.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.modalDeleteBtn}
                onPress={confirmDelete}
                activeOpacity={0.8}
              >
                <Text style={s.modalDeleteText}>Retirer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#fff' },

  // ── Header ──
  header:      {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 14,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F3F4F6',
  },
  headerEmpty: { paddingHorizontal: 16, paddingBottom: 8 },
  closeBtn:    { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: '#111827' },
  addBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  addBtnText:  { fontSize: 13, fontWeight: '700', color: '#111827' },

  // ── Empty ──
  emptyContent:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 24, paddingBottom: 80 },
  emptyTitle:     { fontSize: 22, fontWeight: '700', color: '#111827' },
  emptyText:      { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 21 },
  exploreCta:     { backgroundColor: '#FF6835', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 100 },
  exploreCtaText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // ── Bannière indisponible ──
  unavailableBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF3C7', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#FDE68A',
  },
  unavailableBannerText: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 18 },

  // ── Scroll ──
  scroll: { paddingTop: 8 },

  // ── Items block ──
  itemsBlock: { marginHorizontal: 16, marginTop: 8 },
  divider:    { height: StyleSheet.hairlineWidth, backgroundColor: '#F3F4F6', marginVertical: 4 },

  // ── Item row ──
  itemRow:            { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  itemRowUnavailable: { opacity: 0.6 },
  itemImg:            { width: 68, height: 68, borderRadius: 12 },
  imgUnavailable:     { opacity: 0.4 },
  imgOverlay:         { position: 'absolute', top: 0, left: 0, width: 68, height: 68, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  itemImgPlaceholder: { backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  itemInfo:           { flex: 1, gap: 6 },
  itemTitle:          { fontSize: 14, fontWeight: '700', color: '#111827', lineHeight: 20 },
  textUnavailable:    { color: '#9CA3AF', textDecorationLine: 'line-through' },
  itemPrice:          { fontSize: 14, fontWeight: '700', color: '#111827' },
  unavailableLabel:   { fontSize: 12, fontWeight: '600', color: '#EF4444' },

  // ── Remove button (unavailable) ──
  removeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },

  // ── Stepper ──
  stepper:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 100, paddingHorizontal: 6, paddingVertical: 6, gap: 8 },
  stepperBtn:   { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  stepperCount: { fontSize: 15, fontWeight: '700', color: '#111827', minWidth: 18, textAlign: 'center' },

  // ── Add more ──
  addMoreRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 12 },
  addMoreIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF0EA', alignItems: 'center', justifyContent: 'center' },
  addMoreText: { fontSize: 15, fontWeight: '600', color: '#FF6835' },

  // ── Summary ──
  summary:      { marginHorizontal: 16, marginTop: 16, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F3F4F6', gap: 10 },
  summaryRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 14, color: '#6B7280' },
  summaryValue: { fontSize: 14, fontWeight: '600', color: '#374151' },
  deliveryNote: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },

  // ── Footer sticky ──
  footer:               { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F3F4F6' },
  checkoutBtn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 20 },
  checkoutBtnDisabled:  { backgroundColor: '#9CA3AF' },
  checkoutText:         { fontSize: 16, fontWeight: '700', color: '#fff' },

  // ── Modal ──
  overlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 32, paddingHorizontal: 16 },
  modalCard:       { width: '100%', backgroundColor: '#fff', borderRadius: 24, padding: 24, alignItems: 'center', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 12 },
  modalIcon:       { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFF0EA', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  modalTitle:      { fontSize: 18, fontWeight: '800', color: '#111827', textAlign: 'center' },
  modalBody:       { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20, marginBottom: 8 },
  modalActions:    { flexDirection: 'row', gap: 12, width: '100%', marginTop: 4 },
  modalCancelBtn:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: '#F3F4F6' },
  modalCancelText: { fontSize: 15, fontWeight: '700', color: '#374151' },
  modalDeleteBtn:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: '#FF6835' },
  modalDeleteText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
