// app/(client)/article/[id].tsx
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Dimensions, Image, Modal, Platform,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCartStore } from '@/stores/cartStore';
import type { CustomizationGroup, SelectedOption } from '@/types';
import { TAB_BAR_HEIGHT } from '../_layout';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SlotRow {
  id: string;
  date: string;        // 'YYYY-MM-DD'
  start_time: string;  // 'HH:MM:SS'
  end_time: string;
  max_slots: number;
  booked_slots: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcPromo(item: any): { finalPrice: number | null; badge: string | null } {
  if (!item?.promo_active) return { finalPrice: null, badge: null };
  const price = item.price ?? 0;
  const type  = item.promo_type;
  const val   = item.promo_value ?? 0;
  if (type === 'percentage' && val > 0)
    return { finalPrice: Math.round(price * (1 - val / 100)), badge: `-${val}%` };
  if (type === 'fixed_amount' && val > 0)
    return { finalPrice: Math.max(0, price - val), badge: `-${val.toLocaleString('fr-FR')} FCFA` };
  if (type === 'x_plus_y') {
    const buy = item.promo_buy_qty ?? 1;
    const get = item.promo_get_qty ?? 1;
    return { finalPrice: null, badge: `${buy}+${get} offert` };
  }
  if (type === 'first_free') return { finalPrice: null, badge: '1ère gratuite' };
  if (type === 'promo_code' && item.promo_code) return { finalPrice: null, badge: `Code: ${item.promo_code}` };
  return { finalPrice: null, badge: 'Promo' };
}

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

function safeCustomizations(raw: any): CustomizationGroup[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { const r = JSON.parse(raw); return Array.isArray(r) ? r : []; } catch { return []; }
}

function fmtPrice(price: number, billing: string, unit?: string): string {
  if (billing === 'free')    return 'Gratuit';
  if (billing === 'quote')   return 'Sur devis';
  const p = (price ?? 0).toLocaleString('fr-FR');
  if (billing === 'hourly')  return `${p} FCFA / h`;
  if (billing === 'per_day') return `${p} FCFA / j`;
  if (billing === 'per_unit')return `${p} FCFA / ${unit ?? 'u'}`;
  return `${p} FCFA`;
}

function formatSlotDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.getTime() === today.getTime())    return 'Auj.';
  if (d.getTime() === tomorrow.getTime()) return 'Dem.';
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatSlotTime(timeStr: string): string {
  return timeStr.slice(0, 5);
}

function slotsLeft(slot: SlotRow): number {
  return Math.max(0, slot.max_slots - slot.booked_slots);
}

const { width: W } = Dimensions.get('window');
const IMG_H = W * 0.88;
const ORANGE = '#FF6835';
const TODAY  = new Date().toISOString().split('T')[0];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ArticleDetailPage() {
  const insets     = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { id, businessId } = useLocalSearchParams<{ id: string; businessId: string }>();

  const cartStore  = useCartStore() as any;
  const cartItems  = cartStore.items ?? [];

  const [activeImg,       setActiveImg]       = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<SelectedOption[]>([]);

  // Slot picker state
  const [slotModalOpen,   setSlotModalOpen]   = useState(false);
  const [selectedDate,    setSelectedDate]    = useState<string | null>(null);
  const [selectedSlot,    setSelectedSlot]    = useState<SlotRow | null>(null);
  const [bookingLoading,  setBookingLoading]  = useState(false);

  // ── Cart helpers ─────────────────────────────────────────────────────────
  const makeKey = (opts: SelectedOption[]) => {
    if (!id) return id ?? '';
    if (opts.length === 0) return id;
    const sorted = [...opts].sort((a, b) => a.groupId.localeCompare(b.groupId));
    return `${id}::${JSON.stringify(sorted)}`;
  };
  const cartKey = makeKey(selectedOptions);
  const getQty  = () =>
    cartItems.find((i: any) => i.cartKey === cartKey || i.service_id === cartKey || i.id === id)?.quantity ?? 0;

  // ── Service query ─────────────────────────────────────────────────────────
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

  // ── Slots query (prestations only) ────────────────────────────────────────
  const { data: slots = [], refetch: refetchSlots } = useQuery({
    queryKey: ['slots', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('service_availability')
        .select('id, date, start_time, end_time, max_slots, booked_slots')
        .eq('service_id', id!)
        .gte('date', TODAY)
        .order('date')
        .order('start_time');
      return (data ?? []) as SlotRow[];
    },
    enabled: !!id && item?.kind === 'prestation',
  });

  // ── Realtime subscription ─────────────────────────────────────────────────
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  useEffect(() => {
    if (!id || item?.kind !== 'prestation') return;
    const ch = supabase
      .channel(`slots-${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'service_availability',
        filter: `service_id=eq.${id}`,
      }, () => {
        refetchSlots();
      })
      .subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [id, item?.kind]);

  // ── Derived slot data ─────────────────────────────────────────────────────
  const availableDates = Array.from(new Set(slots.map(s => s.date)));
  const activeDateSlots = slots.filter(s => s.date === (selectedDate ?? availableDates[0]));
  const effectiveDate = selectedDate ?? availableDates[0] ?? null;

  // Auto-select first date when slots load
  useEffect(() => {
    if (availableDates.length > 0 && !selectedDate) {
      setSelectedDate(availableDates[0]);
    }
  }, [availableDates.join(',')]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading || !item) {
    return <View style={s.center}><ActivityIndicator color={ORANGE} size="large" /></View>;
  }

  const allImgs: string[] = [
    ...(safeFirstUrl(item.image_url) ? [safeFirstUrl(item.image_url)!] : []),
    ...safeUrls(item.image_urls).filter((u: string) => u !== safeFirstUrl(item.image_url)),
  ];

  const qty        = getQty();
  const stock      = item.stock_quantity ?? item.stock ?? Infinity;
  const outOfStock = stock !== Infinity && stock <= 0;
  const atMax      = stock !== Infinity && qty >= stock;
  const { finalPrice, badge: promoBadge } = calcPromo(item);

  const isPrestation   = item.kind === 'prestation';
  const isCustomizable = !!(item as any).is_customizable;
  const customGroups   = safeCustomizations((item as any).customizations) as CustomizationGroup[];

  const customPrice  = selectedOptions.reduce((sum, o) => sum + (o.optionPrice ?? 0), 0);
  const basePrice    = item.price ?? 0;
  const displayPrice = isCustomizable
    ? basePrice + customPrice
    : (finalPrice !== null ? finalPrice : basePrice);
  const priceLabel    = fmtPrice(displayPrice, item.billing_type, item.unit);
  const oldPriceLabel = !isCustomizable && finalPrice !== null
    ? fmtPrice(basePrice, item.billing_type, item.unit) : null;
  const showPrice = item.billing_type !== 'free' && item.billing_type !== 'quote';

  const requiredGroupsMet = customGroups
    .filter(g => g.required)
    .every(g => selectedOptions.some(o => o.groupId === g.id));
  const canAdd = !outOfStock && !atMax && (!isCustomizable || requiredGroupsMet);

  const toggleOption = (group: CustomizationGroup, opt: { id: string; label: string; price: number }) => {
    setSelectedOptions(prev => {
      const withoutGroup = prev.filter(o => o.groupId !== group.id);
      const alreadySelected = prev.find(o => o.groupId === group.id && o.optionId === opt.id);
      if (alreadySelected) return withoutGroup;
      return [...withoutGroup, {
        groupId:     group.id,
        groupName:   group.name,
        optionId:    opt.id,
        optionLabel: opt.label,
        optionPrice: opt.price,
      }];
    });
  };

  const getSelectedForGroup = (groupId: string) =>
    selectedOptions.find(o => o.groupId === groupId);

  // ── Navigation ────────────────────────────────────────────────────────────
  const goBack = () => {
    if (businessId) {
      router.replace({ pathname: '/(client)/business/[id]' as any, params: { id: businessId } });
    } else {
      router.replace('/(client)/' as any);
    }
  };

  // ── Article : ajout panier direct ─────────────────────────────────────────
  const handleAddArticle = () => {
    if (!canAdd) return;
    cartStore.addItem(
      {
        id:             item.id,
        title:          item.title,
        price:          isCustomizable ? customPrice : (item.price ?? 0),
        image_url:      allImgs[0] ?? undefined,
        allows_booking: false,
        is_available:   true,
        show_stock:     false,
        currency:       'XOF',
        kind:           item.kind,
      },
      businessId!,
      item.business?.name ?? '',
      isCustomizable ? selectedOptions : undefined,
      isCustomizable ? customPrice : undefined,
    );
  };

  const handleDecrement = () => {
    if (qty <= 1) cartStore.removeItem(cartKey);
    else cartStore.updateQuantity(cartKey, qty - 1);
  };

  // ── Prestation : ouvrir le modal de créneaux ──────────────────────────────
  const handleOpenSlots = () => {
    if (!canAdd) return;
    setSelectedSlot(null);
    setSlotModalOpen(true);
  };

  // ── Prestation : confirmer la réservation (anti double-booking) ───────────
  const handleBookSlot = async () => {
    if (!selectedSlot) return;
    setBookingLoading(true);
    try {
      // 1. Re-lire le créneau en temps réel
      const { data: fresh, error } = await supabase
        .from('service_availability')
        .select('booked_slots, max_slots')
        .eq('id', selectedSlot.id)
        .single();

      if (error || !fresh) {
        Alert.alert('Erreur', 'Impossible de vérifier la disponibilité. Réessaie.');
        return;
      }

      if (fresh.booked_slots >= fresh.max_slots) {
        Alert.alert('Créneau complet', 'Ce créneau vient d\'être réservé. Choisis-en un autre.');
        await refetchSlots();
        setSelectedSlot(null);
        return;
      }

      // 2. Incrément atomique avec contrôle de concurrence optimiste
      //    Si quelqu'un a réservé entre la lecture et ici, booked_slots ne correspond plus → 0 lignes retournées
      const { data: updated } = await supabase
        .from('service_availability')
        .update({ booked_slots: fresh.booked_slots + 1 })
        .eq('id', selectedSlot.id)
        .eq('booked_slots', fresh.booked_slots)   // guard concurrence
        .select('id')
        .maybeSingle();

      if (!updated) {
        Alert.alert('Créneau pris', 'Ce créneau vient d\'être réservé simultanément. Réessaie.');
        await refetchSlots();
        setSelectedSlot(null);
        return;
      }

      // 3. Ajouter au panier avec les infos du créneau
      cartStore.addItem(
        {
          id:             item.id,
          title:          item.title,
          price:          isCustomizable ? customPrice : (item.price ?? 0),
          image_url:      allImgs[0] ?? undefined,
          allows_booking: true,
          is_available:   true,
          show_stock:     false,
          currency:       'XOF',
          kind:           item.kind,
          slot_id:        selectedSlot.id,
          slot_date:      selectedSlot.date,
          slot_time:      formatSlotTime(selectedSlot.start_time),
        },
        businessId!,
        item.business?.name ?? '',
        isCustomizable ? selectedOptions : undefined,
        isCustomizable ? customPrice : undefined,
      );

      setSlotModalOpen(false);
      setSelectedSlot(null);

      // Invalider le cache des créneaux pour que la UI reste à jour
      queryClient.invalidateQueries({ queryKey: ['slots', id] });

    } finally {
      setBookingLoading(false);
    }
  };

  const backBtnTop    = Platform.OS === 'ios' ? insets.top + 10 : 44;
  const bottomOffset  = TAB_BAR_HEIGHT + insets.bottom;
  const actionBarH    = (qty > 0 ? 130 : 70) + 24;

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
              <Text style={{ fontSize: 64 }}>{isPrestation ? '🛠️' : '📦'}</Text>
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
            </>
          )}
        </View>

        {/* ── Infos ── */}
        <View style={s.infoBlock}>

          {/* Nom + badges */}
          <View style={s.nameRow}>
            <Text style={s.name}>{item.title}</Text>
            {promoBadge && !isCustomizable && (
              <View style={s.promoBadgeInline}>
                <Feather name="tag" size={11} color="#fff" />
                <Text style={s.promoBadgeInlineTxt}>{promoBadge}</Text>
              </View>
            )}
            {outOfStock && (
              <View style={s.stockBadge}>
                <Text style={s.stockBadgeTxt}>Rupture</Text>
              </View>
            )}
          </View>

          {/* Prix */}
          {showPrice && oldPriceLabel && (
            <View style={s.promoPriceRow}>
              <Text style={s.promoPriceFinal}>{priceLabel}</Text>
              <Text style={s.promoPriceOld}>{oldPriceLabel}</Text>
            </View>
          )}
          {showPrice && !oldPriceLabel && (
            <Text style={[s.promoPriceFinal, { color: isCustomizable ? ORANGE : '#111827' }]}>
              {priceLabel}
            </Text>
          )}

          {/* Durée (prestation) */}
          {isPrestation && item.duration_minutes && (
            <View style={s.durationPill}>
              <Feather name="clock" size={13} color="#6B7280" />
              <Text style={s.durationPillTxt}>
                {item.duration_minutes >= 60
                  ? `${Math.floor(item.duration_minutes / 60)}h${item.duration_minutes % 60 ? String(item.duration_minutes % 60).padStart(2, '0') : ''}`
                  : `${item.duration_minutes} min`}
              </Text>
            </View>
          )}

          {/* Boutique */}
          {item.business?.name && (
            <TouchableOpacity
              style={s.bizInline}
              onPress={() => businessId && router.push({
                pathname: '/(client)/business/[id]' as any,
                params: { id: businessId },
              })}
              activeOpacity={0.7}
            >
              <Feather name="briefcase" size={13} color={ORANGE} />
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

          {/* ── Sélecteur de personnalisation ── */}
          {isCustomizable && customGroups.length > 0 && (
            <View style={{ gap: 18, marginBottom: 4 }}>
              {customGroups.map(group => {
                const selected = getSelectedForGroup(group.id);
                const missing = group.required && !selected;
                return (
                  <View key={group.id} style={{ gap: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={s.groupName}>{group.name}</Text>
                      {group.required && (
                        <View style={[s.reqBadge, missing && s.reqBadgeMissing]}>
                          <Text style={[s.reqBadgeTxt, missing && { color: '#DC2626' }]}>
                            {missing ? 'Requis' : '✓'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {group.options.map(opt => {
                        const isSelected = selected?.optionId === opt.id;
                        return (
                          <TouchableOpacity
                            key={opt.id}
                            style={[s.optChip, isSelected && s.optChipSelected]}
                            onPress={() => toggleOption(group, opt)}
                            activeOpacity={0.75}
                          >
                            <Text style={[s.optChipLabel, isSelected && s.optChipLabelSelected]}>
                              {opt.label}
                            </Text>
                            {(opt.price ?? 0) > 0 && (
                              <Text style={[s.optChipPrice, isSelected && s.optChipPriceSelected]}>
                                +{opt.price.toLocaleString('fr-FR')} FCFA
                              </Text>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
              <View style={s.divider} />
            </View>
          )}

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

      {/* ══ BARRE D'ACTION ══ */}
      <View style={[s.bottomBar, { bottom: bottomOffset }]}>

        {outOfStock ? (
          <View style={[s.mainBtn, s.mainBtnDisabled]}>
            <Text style={[s.mainBtnTxt, { color: '#9CA3AF' }]}>Rupture de stock</Text>
          </View>

        ) : isPrestation ? (
          /* ─ Prestation : bouton Réserver ─ */
          <TouchableOpacity
            style={[s.mainBtn, !canAdd && s.mainBtnDisabled]}
            onPress={handleOpenSlots}
            activeOpacity={canAdd ? 0.85 : 1}
            disabled={!canAdd}
          >
            <Feather name="calendar" size={18} color={canAdd ? '#fff' : '#9CA3AF'} />
            <Text style={[s.mainBtnTxt, !canAdd && { color: '#9CA3AF' }]}>
              {isCustomizable && !requiredGroupsMet
                ? 'Choisissez vos options'
                : 'Choisir un créneau'}
            </Text>
          </TouchableOpacity>

        ) : qty === 0 ? (
          /* ─ Article : premier ajout ─ */
          <TouchableOpacity
            style={[s.mainBtn, !canAdd && s.mainBtnDisabled]}
            onPress={handleAddArticle}
            activeOpacity={canAdd ? 0.85 : 1}
            disabled={!canAdd}
          >
            <Feather name="shopping-cart" size={18} color={canAdd ? '#fff' : '#9CA3AF'} />
            <Text style={[s.mainBtnTxt, !canAdd && { color: '#9CA3AF' }]}>
              {isCustomizable && !requiredGroupsMet
                ? 'Choisissez vos options'
                : `Ajouter au panier${showPrice && displayPrice > 0 ? `  ·  ${priceLabel}` : ''}`}
            </Text>
          </TouchableOpacity>

        ) : (
          /* ─ Article : qty > 0 ─ */
          <View style={{ gap: 10 }}>
            <View style={s.qtyRow}>
              <TouchableOpacity style={s.qtyMinus} onPress={handleDecrement} activeOpacity={0.8}>
                <Feather name="minus" size={18} color={ORANGE} />
              </TouchableOpacity>
              <View style={s.qtyValWrap}>
                <Text style={s.qtyVal}>{qty}</Text>
                <Text style={s.qtyUnit}>dans le panier</Text>
              </View>
              <TouchableOpacity
                style={[s.qtyPlus, (atMax || !canAdd) && s.qtyPlusDisabled]}
                onPress={handleAddArticle}
                disabled={atMax || !canAdd}
                activeOpacity={(atMax || !canAdd) ? 1 : 0.8}
              >
                <Feather name="plus" size={18} color={(atMax || !canAdd) ? '#9CA3AF' : '#fff'} />
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

      {/* ══ MODAL CRÉNEAUX ══ */}
      <Modal
        visible={slotModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSlotModalOpen(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>

            {/* Header */}
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Choisir un créneau</Text>
              <TouchableOpacity
                style={s.modalCloseBtn}
                onPress={() => setSlotModalOpen(false)}
              >
                <Feather name="x" size={18} color="#374151" />
              </TouchableOpacity>
            </View>

            {/* Date tabs */}
            {availableDates.length === 0 ? (
              <View style={s.noSlots}>
                <Feather name="calendar" size={32} color="#D1D5DB" />
                <Text style={s.noSlotsTxt}>Aucun créneau disponible pour le moment.</Text>
              </View>
            ) : (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.dateTabs}
                >
                  {availableDates.map(date => {
                    const isActive = effectiveDate === date;
                    const hasAvail = slots.some(s2 => s2.date === date && slotsLeft(s2) > 0);
                    return (
                      <TouchableOpacity
                        key={date}
                        style={[s.dateTab, isActive && s.dateTabActive, !hasAvail && s.dateTabFull]}
                        onPress={() => { setSelectedDate(date); setSelectedSlot(null); }}
                        activeOpacity={0.75}
                      >
                        <Text style={[s.dateTabTxt, isActive && s.dateTabTxtActive]}>
                          {formatSlotDate(date)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Time slots */}
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={s.timeSlotList}
                  showsVerticalScrollIndicator={false}
                >
                  {activeDateSlots.map(slot => {
                    const left    = slotsLeft(slot);
                    const isFull  = left <= 0;
                    const isPicked = selectedSlot?.id === slot.id;
                    return (
                      <TouchableOpacity
                        key={slot.id}
                        style={[
                          s.timeSlot,
                          isPicked && s.timeSlotPicked,
                          isFull   && s.timeSlotFull,
                        ]}
                        onPress={() => !isFull && setSelectedSlot(slot)}
                        activeOpacity={isFull ? 1 : 0.75}
                        disabled={isFull}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                          <Feather
                            name={isFull ? 'x-circle' : isPicked ? 'check-circle' : 'clock'}
                            size={18}
                            color={isFull ? '#D1D5DB' : isPicked ? ORANGE : '#374151'}
                          />
                          <Text style={[
                            s.timeSlotTime,
                            isFull   && { color: '#9CA3AF' },
                            isPicked && { color: ORANGE },
                          ]}>
                            {formatSlotTime(slot.start_time)}
                          </Text>
                        </View>
                        <Text style={[
                          s.timeSlotAvail,
                          isFull   && { color: '#D1D5DB' },
                          isPicked && { color: ORANGE },
                          left === 1 && !isFull && { color: '#F59E0B' },
                        ]}>
                          {isFull
                            ? 'Complet'
                            : left === 1
                              ? '1 place restante'
                              : `${left} places`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Confirm button */}
                <View style={s.modalFooter}>
                  <TouchableOpacity
                    style={[s.confirmBtn, (!selectedSlot || bookingLoading) && s.confirmBtnDisabled]}
                    onPress={handleBookSlot}
                    disabled={!selectedSlot || bookingLoading}
                    activeOpacity={0.85}
                  >
                    {bookingLoading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Feather name="check" size={18} color={selectedSlot ? '#fff' : '#9CA3AF'} />
                        <Text style={[s.confirmBtnTxt, !selectedSlot && { color: '#9CA3AF' }]}>
                          {selectedSlot
                            ? `Réserver  ·  ${formatSlotTime(selectedSlot.start_time)}`
                            : 'Sélectionne un créneau'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
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

  galleryWrap:    { width: W, backgroundColor: '#F3F4F6', position: 'relative' },
  imgPlaceholder: { width: W, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  dots:           { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot:            { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive:      { backgroundColor: '#fff', width: 18 },
  imgCounter:     { position: 'absolute', bottom: 12, right: 14, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  imgCounterTxt:  { fontSize: 12, fontWeight: '600', color: '#fff' },

  promoBadgeInline:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EF4444', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  promoBadgeInlineTxt: { fontSize: 12, fontWeight: '700', color: '#fff' },
  promoPriceRow:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  promoPriceFinal:     { fontSize: 20, fontWeight: '800', color: '#111827' },
  promoPriceOld:       { fontSize: 15, fontWeight: '500', color: '#9CA3AF', textDecorationLine: 'line-through' },

  infoBlock:    { padding: 20, gap: 10 },
  nameRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  name:         { fontSize: 22, fontWeight: '800', color: '#111827', flex: 1, lineHeight: 28 },
  stockBadge:    { backgroundColor: '#FEF2F2', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  stockBadgeTxt: { fontSize: 12, fontWeight: '700', color: '#EF4444' },
  durationPill:  { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: '#F3F4F6', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5 },
  durationPillTxt:{ fontSize: 13, fontWeight: '600', color: '#6B7280' },
  bizInline:    { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  bizInlineTxt: { fontSize: 13, fontWeight: '600', color: ORANGE },
  stockRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stockTxt:     { fontSize: 13, color: '#6B7280' },
  divider:      { height: 1, backgroundColor: '#F3F4F6', marginVertical: 4 },
  descBlock:    { gap: 8 },
  descLabel:    { fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },
  desc:         { fontSize: 15, color: '#374151', lineHeight: 24 },
  noDesc:       { fontSize: 14, color: '#9CA3AF', fontStyle: 'italic' },

  // Personnalisation
  groupName:             { fontSize: 15, fontWeight: '800', color: '#111827' },
  reqBadge:              { backgroundColor: '#F3F4F6', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
  reqBadgeMissing:       { backgroundColor: '#FEF2F2' },
  reqBadgeTxt:           { fontSize: 11, fontWeight: '700', color: '#6B7280' },
  optChip:               { flexDirection: 'column', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: '#E5E7EB', gap: 2 },
  optChipSelected:       { backgroundColor: '#FEF2EC', borderColor: ORANGE },
  optChipLabel:          { fontSize: 14, fontWeight: '600', color: '#374151' },
  optChipLabelSelected:  { color: ORANGE, fontWeight: '700' },
  optChipPrice:          { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  optChipPriceSelected:  { color: ORANGE },

  // Barre d'action
  bottomBar: {
    position: 'absolute', left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14,
  },
  mainBtn:         { height: 54, backgroundColor: ORANGE, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  mainBtnDisabled: { backgroundColor: '#F3F4F6' },
  mainBtnTxt:      { fontSize: 15, fontWeight: '800', color: '#fff' },
  qtyRow:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qtyMinus:        { width: 48, height: 48, borderRadius: 14, backgroundColor: '#FEF2EC', borderWidth: 1.5, borderColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  qtyValWrap:      { alignItems: 'center' },
  qtyVal:          { fontSize: 22, fontWeight: '800', color: '#111827' },
  qtyUnit:         { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  qtyPlus:         { width: 48, height: 48, borderRadius: 14, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  qtyPlusDisabled: { backgroundColor: '#E5E7EB' },
  cartBtn:         { height: 50, backgroundColor: '#111827', borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  cartBtnTxt:      { fontSize: 15, fontWeight: '800', color: '#fff' },

  // Modal créneaux
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  modalTitle:    { fontSize: 18, fontWeight: '800', color: '#111827' },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },

  noSlots:    { alignItems: 'center', gap: 12, paddingVertical: 48, paddingHorizontal: 24 },
  noSlotsTxt: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },

  dateTabs: { paddingHorizontal: 16, paddingVertical: 14, gap: 8, flexDirection: 'row' },
  dateTab: {
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 100, backgroundColor: '#F3F4F6',
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  dateTabActive: { backgroundColor: '#FEF2EC', borderColor: ORANGE },
  dateTabFull:   { opacity: 0.5 },
  dateTabTxt:    { fontSize: 13, fontWeight: '600', color: '#374151' },
  dateTabTxtActive: { color: ORANGE, fontWeight: '700' },

  timeSlotList: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  timeSlot: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 14, backgroundColor: '#F9FAFB',
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  timeSlotPicked: { backgroundColor: '#FEF2EC', borderColor: ORANGE },
  timeSlotFull:   { backgroundColor: '#F9FAFB', borderColor: '#F3F4F6' },
  timeSlotTime:   { fontSize: 16, fontWeight: '800', color: '#111827' },
  timeSlotAvail:  { fontSize: 12, fontWeight: '600', color: '#6B7280' },

  modalFooter: { padding: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  confirmBtn: {
    height: 54, backgroundColor: ORANGE, borderRadius: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  confirmBtnDisabled: { backgroundColor: '#F3F4F6' },
  confirmBtnTxt:      { fontSize: 15, fontWeight: '800', color: '#fff' },
});
