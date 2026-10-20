/**
 * app/(client)/index.tsx — Page d'accueil
 * Design fidèle aux maquettes fournies — données 100 % Supabase
 */
import { Feather, Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  Animated, Dimensions, FlatList, Image, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { useCartStore } from '@/stores/cartStore';
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle';
import { useLocationStore } from '@/stores/locationStore';
import { CountryMismatchWarning } from '@/components/WarningBanner';
import { useBusinesses } from '@/hooks/useBusinesses';
import { useLocation } from '@/hooks/useLocation';
import { isBusinessOpen, getDistanceKm, formatDistance } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import LocationPickerModal from '@/components/LocationPickerModal';
import { ALL_CITIES } from '@/types';
import type { Business, Service } from '@/types';

const { width: W } = Dimensions.get('window');

// ── Tokens ─────────────────────────────────────────────────────────────────────
const ORANGE  = '#FF6835';
const DARK    = '#111827';
const GRAY    = '#6B7280';
const GRAY_LT = '#F5F5F5';
const WHITE   = '#FFFFFF';
const TEAL    = '#06B6D4';
const H_PAD   = 20;

// ── Catégories homepage ────────────────────────────────────────────────────────
const CAT_ICONS = {
  offres:     require('@/assets/images/discount.png'),
  restaurant: require('@/assets/images/restaurant.png'),
  mode:       require('@/assets/images/clothes.png'),
  beaute:     require('@/assets/images/beauty.png'),
  maison:     require('@/assets/images/house.png'),
  tech:       require('@/assets/images/tech.png'),
  ouvrier:    require('@/assets/images/services.png'),
} as const;

const HOME_CATS: { id: keyof typeof CAT_ICONS; label: string; bg: string }[] = [
  { id: 'offres',      label: 'Offres',      bg: '#FFF0EA' },
  { id: 'restaurant',  label: 'Restaurants', bg: '#FFF7ED' },
  { id: 'mode',        label: 'Mode',        bg: '#FAF0FC' },
  { id: 'beaute',      label: 'Beauté',      bg: '#FFF0F6' },
  { id: 'maison',      label: 'Maison',      bg: '#F0F9FF' },
  { id: 'tech',        label: 'Tech',        bg: '#EFF6FF' },
  { id: 'ouvrier',     label: 'Services',    bg: '#F0FDF4' },
];

// ── Hero banners (catalogue statique — filtrés dynamiquement selon la ville) ────
const ALL_HERO_BANNERS = [
  {
    id:       'nouveautes',
    title:    'Plus de nouveautés\nautour de vous.',
    sub:      "De nouveaux commerces viennent d'arriver près de chez vous.",
    cta:      'Voir les boutiques',
    color:    '#A8301F',
    image:    'https://images.unsplash.com/photo-1680713660046-67b7350ed679?auto=format&fit=crop&w=1000&q=85',
    filters:  { has_delivery: true } as Record<string, any>,
  },
  {
    id:       'mode',
    title:    'Affirmez votre style,\nautrement.',
    sub:      'Créateurs locaux, collections exclusives, livraison disponible.',
    cta:      'Explorer la mode',
    color:    '#372154',
    image:    'https://images.unsplash.com/photo-1558642842-d30b4b0e4448?auto=format&fit=crop&w=1000&q=85',
    filters:  { category: 'mode' } as Record<string, any>,
  },
  {
    id:       'restaurant',
    title:    'Vos saveurs préférées,\nlivrées.',
    sub:      'Restaurants et traiteurs avec livraison à domicile.',
    cta:      'Commander maintenant',
    color:    '#61401E',
    image:    'https://images.unsplash.com/photo-1585540083814-ea6ee8af9e4f?auto=format&fit=crop&w=1000&q=85',
    filters:  { category: 'restaurant', has_delivery: true } as Record<string, any>,
  },
] as const;

// ── Bannières vendeur (contenu marketing statique) ─────────────────────────────
const SELLER_BANNERS = [
  { id: '1', tag: 'VOUS ÊTES COMMERÇANT ?',       title: 'Ouvrez votre boutique et\ncommencez à vendre.',        sub: 'Touchez de nouveaux clients partout au Bénin.',         cta: 'Créer ma boutique',     bg: '#171717', accent: ORANGE    },
  { id: '2', tag: 'VOUS PROPOSEZ DES SERVICES ?', title: 'Transformez votre savoir-faire\nen opportunités.',     sub: 'Gérez vos réservations et développez votre activité.',  cta: 'Proposer mes services', bg: '#17213B', accent: '#4B6FC7' },
];

// ── Type service enrichi (join avec businesses) ────────────────────────────────
type ServiceWithBusiness = Service & {
  business?: { name: string; cover_url?: string | null; category_icon?: string | null };
};

// ── Type zones de livraison ────────────────────────────────────────────────────
type ZoneInfo = { count: number; firstLabel: string };

// ── Type modal section ─────────────────────────────────────────────────────────
type SectionModalData =
  | { kind: 'businesses'; title: string; items: Business[]; userLat?: number|null; userLon?: number|null; searchable?: boolean }
  | { kind: 'offers';     title: string; items: ServiceWithBusiness[] }
  | { kind: 'services';   title: string; items: ServiceWithBusiness[] }
  | null;

// ── Helpers ────────────────────────────────────────────────────────────────────
function getBadgeLabel(b: Business): string {
  if ((b.rating ?? 0) >= 4.8)                              return 'Très apprécié';
  if (b.category?.toLowerCase().includes('artisan'))        return 'Créateur local';
  if (Date.now() - new Date(b.created_at).getTime() < 30 * 24 * 3600 * 1000) return 'Nouveau';
  return b.city ? `Populaire à ${b.city}` : 'À découvrir';
}

function getCatalogBadge(item: ServiceWithBusiness): string | null {
  if (item.created_at && Date.now() - new Date(item.created_at).getTime() < 30 * 24 * 3600 * 1000) return 'Nouveau';
  if (item.billing_type === 'hourly') return '/h';
  if (item.billing_type === 'quote')  return 'Devis';
  return null;
}

// Toute boutique affiche au minimum 1,0 étoile (jamais 0)
function fmtRating(r?: number | null): string {
  return Math.max(1, r ?? 0).toFixed(1).replace('.', ',');
}

// Nombre de zones de livraison — calculé depuis la Map fetchée en HomeScreen
// (plus de fallback sur l'objet business — la Map est la seule source de vérité)

// ── Composant : photo ou placeholder ──────────────────────────────────────────
function CoverPhoto({ uri, style, emoji }: { uri?: string | null; style: any; emoji?: string }) {
  if (uri) return <Image source={{ uri }} style={style} resizeMode="cover" />;
  return (
    <View style={[style, { backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ fontSize: 38 }}>{emoji ?? '🏪'}</Text>
    </View>
  );
}

// ── Rangée de statut ───────────────────────────────────────────────────────────
function StatusRow({ open, time, reviews, promo }: { open: boolean; time?: string; reviews?: number; promo?: string | null }) {
  return (
    <View style={sh.statusRow}>
      <Text style={[sh.openTxt, !open && { color: '#EF4444' }]}>{open ? 'Ouvert' : 'Fermé'}</Text>
      {time != null && <><Text style={sh.dot}>·</Text><Text style={sh.meta}>{time}</Text></>}
      <Text style={sh.dot}>·</Text>
      <Text style={sh.meta}>{reviews ?? 0} avis</Text>
      {!!promo && (
        <>
          <View style={{ flex: 1 }} />
          <Text style={sh.promoTxt} numberOfLines={1}>{promo}</Text>
        </>
      )}
    </View>
  );
}

// ── DeliveryRow — icône livraison sous la catégorie (uniquement si livraison dispo) ──
function DeliveryRow({ zoneInfo }: { zoneInfo?: { count: number; firstLabel: string } }) {
  if (!zoneInfo || zoneInfo.count === 0) return null;
  const { count, firstLabel } = zoneInfo;
  const label = count > 1
    ? `Livraison à ${firstLabel} et ${count - 1} autre${count - 1 > 1 ? 's' : ''}`
    : `Livraison à ${firstLabel}`;
  return (
    <View style={dlv.row}>
      <Feather name="truck" size={11} color="#22C55E" />
      <Text style={dlv.available} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// ── NearbyCard ─────────────────────────────────────────────────────────────────
function NearbyCard({ b, userLat, userLon, idx, zoneInfo }: { b: Business; userLat?: number|null; userLon?: number|null; idx: number; zoneInfo?: { count: number; firstLabel: string } }) {
  const { isFav: fav, toggle: toggleFav } = useFavoriteToggle(b.id);
  const open  = isBusinessOpen(b.hours, (b as any).timezone);
  const dist  = (userLat && userLon && (b as any).latitude && (b as any).longitude)
    ? formatDistance(getDistanceKm(userLat, userLon, (b as any).latitude, (b as any).longitude))
    : null;

  return (
    <TouchableOpacity
      style={nc.card}
      onPress={() => router.push({ pathname: '/(client)/business/[id]', params: { id: b.id } })}
      activeOpacity={0.88}
    >
      <View style={nc.imgWrap}>
        <CoverPhoto uri={b.cover_url} style={nc.img} emoji={b.category_icon} />
        <TouchableOpacity style={nc.heart} onPress={(e) => { e.stopPropagation?.(); toggleFav(); }}>
          <Ionicons name={fav ? 'heart' : 'heart-outline'} size={15} color={fav ? ORANGE : '#374151'} />
        </TouchableOpacity>
      </View>
      <View style={nc.body}>
        <View style={nc.nameRow}>
          <Text style={nc.name} numberOfLines={1}>{b.name}</Text>
          <View style={nc.ratingRow}>
            <Feather name="star" size={11} color="#F59E0B" />
            <Text style={nc.rating}>{fmtRating(b.rating)}</Text>
          </View>
        </View>
        {b.category && (
          <Text style={nc.category} numberOfLines={1}>{b.category}</Text>
        )}
        {/* Livraison sous la catégorie */}
        <DeliveryRow zoneInfo={zoneInfo} />
        <StatusRow open={open} time={dist ?? undefined} reviews={b.review_count} promo={(b as any).current_promotion ?? (b as any).promotion_label ?? null} />
      </View>
    </TouchableOpacity>
  );
}

// ── OfferCard (catalogue DB) ───────────────────────────────────────────────────
function OfferCard({ item }: { item: ServiceWithBusiness }) {
  const badge = getCatalogBadge(item);
  const image = item.image_url ?? item.business?.cover_url ?? null;
  const emoji = item.business?.category_icon ?? '🛍️';
  return (
    <TouchableOpacity
      style={oc.card}
      onPress={() => router.push({ pathname: '/(client)/business/[id]' as any, params: { id: item.business_id } })}
      activeOpacity={0.88}
    >
      <View style={oc.imgWrap}>
        <CoverPhoto uri={image} style={oc.img} emoji={emoji} />
        {badge && <View style={oc.badge}><Text style={oc.badgeTxt}>{badge}</Text></View>}
      </View>
      <Text style={oc.name} numberOfLines={2}>{item.title}</Text>
      <Text style={oc.shop} numberOfLines={1}>{item.business?.name ?? ''}</Text>
      <View style={oc.priceRow}>
        <Text style={oc.price}>
          {item.price ? `${item.price.toLocaleString('fr-FR')} ${item.currency ?? 'FCFA'}` : 'Sur devis'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── PopularCard (businesses DB triés par note) ─────────────────────────────────
function PopularCard({ b }: { b: Business }) {
  const detail = `${fmtRating(b.rating)} · ${b.review_count ?? 0} avis`;
  const location = [b.city, (b as any).country].filter(Boolean).join(', ') || 'Adresse non renseignée';
  return (
    <TouchableOpacity
      style={pc.card}
      onPress={() => router.push({ pathname: '/(client)/business/[id]', params: { id: b.id } })}
      activeOpacity={0.88}
    >
      <View style={pc.imgWrap}>
        <CoverPhoto uri={b.cover_url} style={pc.img} emoji={b.category_icon} />
        <View style={pc.statOverlay}>
          <Feather name="map-pin" size={9} color="rgba(255,255,255,0.8)" style={{ marginRight: 4 }} />
          <Text style={pc.statTxt} numberOfLines={1}>{location}</Text>
        </View>
      </View>
      <Text style={pc.name} numberOfLines={1}>{b.name}</Text>
      <Text style={pc.sub}  numberOfLines={1}>{detail}</Text>
    </TouchableOpacity>
  );
}

// ── DiscoverCard / ExploreCard ─────────────────────────────────────────────────
function DiscoverCard({ b, userLat, userLon, zoneInfo }: { b: Business; userLat?: number|null; userLon?: number|null; zoneInfo?: { count: number; firstLabel: string } }) {
  const { isFav: fav, toggle: toggleFav } = useFavoriteToggle(b.id);
  const open = isBusinessOpen(b.hours, (b as any).timezone);
  const dist = (userLat && userLon && (b as any).latitude && (b as any).longitude)
    ? formatDistance(getDistanceKm(userLat, userLon, (b as any).latitude, (b as any).longitude))
    : null;
  return (
    <TouchableOpacity
      style={dc.card}
      onPress={() => router.push({ pathname: '/(client)/business/[id]', params: { id: b.id } })}
      activeOpacity={0.88}
    >
      <View style={dc.imgWrap}>
        <CoverPhoto uri={b.cover_url} style={dc.img} emoji={b.category_icon} />
        <View style={dc.badge}><Text style={dc.badgeTxt}>{getBadgeLabel(b)}</Text></View>
        <TouchableOpacity style={dc.heart} onPress={(e) => { e.stopPropagation?.(); toggleFav(); }}>
          <Ionicons name={fav ? 'heart' : 'heart-outline'} size={15} color={fav ? ORANGE : '#374151'} />
        </TouchableOpacity>
      </View>
      <View style={dc.body}>
        <View style={dc.nameRow}>
          <Text style={dc.name} numberOfLines={1}>{b.name}</Text>
          <View style={dc.ratingRow}>
            <Feather name="star" size={12} color="#F59E0B" />
            <Text style={dc.rating}>{fmtRating(b.rating)}</Text>
          </View>
        </View>
        {b.category && <Text style={dc.category} numberOfLines={1}>{b.category}</Text>}
        {/* Livraison sous la catégorie */}
        <DeliveryRow zoneInfo={zoneInfo} />
        <StatusRow open={open} time={dist ?? undefined} reviews={b.review_count} promo={(b as any).current_promotion ?? (b as any).promotion_label ?? null} />
      </View>
    </TouchableOpacity>
  );
}

// ── ServiceCard (services réservables DB) ──────────────────────────────────────
function ServiceCard({ item }: { item: ServiceWithBusiness }) {
  const image     = item.image_url ?? item.business?.cover_url ?? null;
  const emoji     = item.business?.category_icon ?? '🛠️';
  const timeLabel = item.duration_minutes
    ? item.duration_minutes < 60
      ? `${item.duration_minutes} min`
      : `${Math.floor(item.duration_minutes / 60)} h${item.duration_minutes % 60 > 0 ? ` ${item.duration_minutes % 60}` : ''}`
    : 'Sur RDV';
  return (
    <TouchableOpacity
      style={svc.card}
      onPress={() => router.push({ pathname: '/(client)/business/[id]', params: { id: item.business_id } })}
      activeOpacity={0.88}
    >
      <View style={svc.imgWrap}>
        <CoverPhoto uri={image} style={svc.img} emoji={emoji} />
        <View style={svc.timeBadge}><Text style={svc.timeTxt}>{timeLabel}</Text></View>
      </View>
      <View style={{ padding: 10 }}>
        <Text style={svc.name} numberOfLines={1}>{item.title}</Text>
        <Text style={svc.provider} numberOfLines={1}>{item.business?.name ?? ''}</Text>
        <Text style={svc.price}>
          {item.price
            ? `${item.price.toLocaleString('fr-FR')} ${item.currency ?? 'FCFA'}`
            : 'Sur devis'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── ServiceCardFull (version plein-largeur pour la liste modale) ───────────────
function ServiceCardFull({ item }: { item: ServiceWithBusiness }) {
  const image     = item.image_url ?? item.business?.cover_url ?? null;
  const emoji     = item.business?.category_icon ?? '🛠️';
  const timeLabel = item.duration_minutes
    ? item.duration_minutes < 60
      ? `${item.duration_minutes} min`
      : `${Math.floor(item.duration_minutes / 60)} h${item.duration_minutes % 60 > 0 ? ` ${item.duration_minutes % 60}` : ''}`
    : 'Sur RDV';
  return (
    <TouchableOpacity
      style={svf.card}
      onPress={() => router.push({ pathname: '/(client)/business/[id]', params: { id: item.business_id } })}
      activeOpacity={0.88}
    >
      <View style={svf.imgWrap}>
        <CoverPhoto uri={image} style={svf.img} emoji={emoji} />
        <View style={svf.timeBadge}><Text style={svc.timeTxt}>{timeLabel}</Text></View>
      </View>
      <View style={svf.body}>
        <Text style={svf.name} numberOfLines={2}>{item.title}</Text>
        <Text style={svf.provider} numberOfLines={1}>{item.business?.name ?? ''}</Text>
        <Text style={svf.price}>
          {item.price
            ? `Dès ${item.price.toLocaleString('fr-FR')} ${item.currency ?? 'FCFA'}`
            : 'Sur devis'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── OfferCardFull (version plein-largeur pour la liste modale) ────────────────
function OfferCardFull({ item }: { item: ServiceWithBusiness }) {
  const badge = getCatalogBadge(item);
  const image = item.image_url ?? item.business?.cover_url ?? null;
  const emoji = item.business?.category_icon ?? '🛍️';
  return (
    <TouchableOpacity
      style={off.card}
      onPress={() => router.push({ pathname: '/(client)/business/[id]', params: { id: item.business_id } })}
      activeOpacity={0.88}
    >
      <View style={off.imgWrap}>
        <CoverPhoto uri={image} style={off.img} emoji={emoji} />
        {badge && <View style={oc.badge}><Text style={oc.badgeTxt}>{badge}</Text></View>}
      </View>
      <View style={off.body}>
        <Text style={off.name} numberOfLines={2}>{item.title}</Text>
        <Text style={off.shop} numberOfLines={1}>{item.business?.name ?? ''}</Text>
        <Text style={off.price}>
          {item.price ? `${item.price.toLocaleString('fr-FR')} ${item.currency ?? 'FCFA'}` : 'Sur devis'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── SectionListModal ──────────────────────────────────────────────────────────
function SectionListModal({ data, onClose, zoneCountMap }: { data: SectionModalData; onClose: () => void; zoneCountMap: Map<string, ZoneInfo> }) {
  const insets   = useSafeAreaInsets();
  const [searchQ, setSearchQ] = useState('');

  // Reset search when modal opens on a new section
  const dataKey = data ? data.title : '';
  useEffect(() => { setSearchQ(''); }, [dataKey]);

  if (!data) return null;

  const searchable = data.kind === 'businesses' && !!data.searchable;

  const bizItems: Business[] = data.kind === 'businesses'
    ? searchable && searchQ.trim()
      ? data.items.filter(b =>
          b.name.toLowerCase().includes(searchQ.toLowerCase()) ||
          b.city?.toLowerCase().includes(searchQ.toLowerCase()) ||
          b.category?.toLowerCase().includes(searchQ.toLowerCase())
        )
      : data.items
    : [];

  const renderEmpty = () => (
    <View style={slm.empty}>
      <Feather name="search" size={44} color="#D1D5DB" />
      <Text style={slm.emptyTxt}>Aucun élément disponible</Text>
    </View>
  );

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[slm.root, { paddingTop: insets.top || (Platform.OS === 'android' ? 24 : 0) }]}>
        {/* Header */}
        <View style={slm.header}>
          <TouchableOpacity onPress={onClose} hitSlop={12} style={slm.backBtn}>
            <Feather name="arrow-left" size={20} color={DARK} />
          </TouchableOpacity>
          <Text style={slm.title}>{data.title}</Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Barre de recherche (uniquement pour les villes) */}
        {searchable && (
          <View style={slm.searchWrap}>
            <Feather name="search" size={15} color="#9CA3AF" style={{ marginRight: 8 }} />
            <TextInput
              style={slm.searchInput}
              placeholder={`Rechercher dans ${data.title}...`}
              placeholderTextColor="#9CA3AF"
              value={searchQ}
              onChangeText={setSearchQ}
              autoCorrect={false}
            />
            {searchQ.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQ('')} hitSlop={8}>
                <Feather name="x" size={15} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Contenu */}
        {data.kind === 'businesses' && (
          bizItems.length === 0 ? renderEmpty() : (
            <FlatList
              data={bizItems}
              keyExtractor={item => item.id}
              contentContainerStyle={slm.list}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <DiscoverCard b={item} userLat={data.userLat} userLon={data.userLon} zoneInfo={zoneCountMap.get(item.id)} />
              )}
            />
          )
        )}

        {data.kind === 'offers' && (
          data.items.length === 0 ? renderEmpty() : (
            <FlatList
              data={data.items}
              keyExtractor={item => item.id}
              contentContainerStyle={slm.list}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => <OfferCardFull item={item} />}
            />
          )
        )}

        {data.kind === 'services' && (
          data.items.length === 0 ? renderEmpty() : (
            <FlatList
              data={data.items}
              keyExtractor={item => item.id}
              contentContainerStyle={slm.list}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => <ServiceCardFull item={item} />}
            />
          )
        )}
      </View>
    </Modal>
  );
}

// ── SecHeader ──────────────────────────────────────────────────────────────────
function SecHeader({ title, linkLabel = 'Voir tout', onPress }: { title: string; linkLabel?: string; onPress?: () => void }) {
  return (
    <View style={g.secHeader}>
      <Text style={g.secTitle}>{title}</Text>
      {onPress && <TouchableOpacity onPress={onPress}><Text style={g.seeAll}>{linkLabel}</Text></TouchableOpacity>}
    </View>
  );
}

// ── HeroBanner ────────────────────────────────────────────────────────────────
type HeroBannerItem = typeof ALL_HERO_BANNERS[number];
function HeroBanner({ banners }: { banners: readonly HeroBannerItem[] }) {
  const [active, setActive] = useState(0);
  const ref = useRef<ScrollView>(null);
  const BW  = W - H_PAD * 2;
  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => {
      setActive(prev => {
        const next = (prev + 1) % banners.length;
        ref.current?.scrollTo({ x: next * BW, animated: true });
        return next;
      });
    }, 4000);
    return () => clearInterval(t);
  }, [BW, banners.length]);

  if (banners.length === 0) return null;

  return (
    <View style={{ marginBottom: 28, position: 'relative' }}>
      <ScrollView ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        decelerationRate="fast" snapToInterval={BW}
        onMomentumScrollEnd={e => setActive(Math.round(e.nativeEvent.contentOffset.x / BW))}
      >
        {banners.map(b => (
          <View key={b.id} style={[hb.card, { width: BW }]}>
            <Image source={{ uri: b.image }} style={hb.bgImg} resizeMode="cover" />
            <View style={[hb.overlay, { backgroundColor: b.color + 'CC' }]} />
            <View style={hb.content}>
              <Text style={hb.title}>{b.title}</Text>
              <Text style={hb.sub}>{b.sub}</Text>
              <TouchableOpacity
                style={hb.ctaBtn}
                onPress={() => router.push({ pathname: '/(client)/search', params: b.filters })}
              >
                <Text style={[hb.ctaTxt, { color: b.color }]}>{b.cta}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
      {/* Dots superposés sur le banner */}
      {banners.length > 1 && (
        <View style={hb.dots}>
          {banners.map((_, i) => (
            <View key={i} style={[hb.dot, i === active && hb.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

// ── SellerBanner — crossfade propre sans glitch ───────────────────────────────
function SellerBanner() {
  const [bottomIdx, setBottomIdx] = useState(0);
  const [topIdx,    setTopIdx]    = useState(1);
  const topOpacity = useRef(new Animated.Value(0)).current;
  const nextRef    = useRef(1);

  useEffect(() => {
    const tick = () => {
      const ni = nextRef.current;
      setTopIdx(ni);
      Animated.timing(topOpacity, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        setBottomIdx(ni);
        nextRef.current = (ni + 1) % SELLER_BANNERS.length;
        requestAnimationFrame(() => { topOpacity.setValue(0); });
      });
    };
    const t = setInterval(tick, 6000);
    return () => clearInterval(t);
  }, []);

  const renderCard = (item: typeof SELLER_BANNERS[number]) => (
    <View style={[promo.card, { backgroundColor: item.bg }]}>
      <View style={promo.circleOuter} />
      <View style={promo.circleInner} />
      <Text style={promo.tag}>{item.tag}</Text>
      <Text style={promo.title}>{item.title}</Text>
      <Text style={promo.sub}>{item.sub}</Text>
      <TouchableOpacity
        style={[promo.cta, { backgroundColor: item.accent }]}
        onPress={() => router.push('/(pro)/register/step1' as any)}
      >
        <Text style={promo.ctaTxt}>{item.cta}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ marginBottom: 28 }}>
      {renderCard(SELLER_BANNERS[bottomIdx])}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: topOpacity }]} pointerEvents="none">
        {renderCard(SELLER_BANNERS[topIdx])}
      </Animated.View>
    </View>
  );
}

// ── Écran principal ────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets      = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const cartStore   = useCartStore() as any;
  const cartTotal   = (cartStore.items ?? []).reduce((a: number, i: any) => a + (i.quantity ?? 0), 0);
  useLocation();
  const locationStore = useLocationStore();
  const queryClient   = useQueryClient();

  // ── Actualisation au focus + tick toutes les minutes pour le statut ouvert/fermé
  const [_tick, setTick] = useState(0);
  useFocusEffect(useCallback(() => {
    // Invalide toutes les queries de la page pour forcer un rechargement
    queryClient.invalidateQueries({ queryKey: ['businesses'] });
    queryClient.invalidateQueries({ queryKey: ['home-catalog'] });
    queryClient.invalidateQueries({ queryKey: ['home-services'] });
    // Tick toutes les 60 secondes pour recalculer open/fermé sans requête réseau
    const interval = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(interval);
  }, [queryClient]));
  const savedCity     = (locationStore as any).city    ?? null;
  const savedSuburb   = (locationStore as any).suburb  ?? null;   // ← quartier (ex: "Godomey")
  const savedAddress  = (locationStore as any).address ?? null;
  const savedLabel    = (locationStore as any).label   ?? null;
  const userLat       = (locationStore as any).lat     ?? null;
  const userLon       = (locationStore as any).lon     ?? null;

  const [selCat,                setSelCat]                = useState<string | null>(null);
  const [addrPopup,             setAddrPopup]             = useState(false);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [unreadNotifs,          setUnreadNotifs]          = useState(0);
  const [sectionModal,          setSectionModal]          = useState<SectionModalData>(null);

  const cityName   = savedCity ?? null;
  const hasAddress = !!(savedAddress || savedCity);
  const topPad     = insets.top || (Platform.OS === 'android' ? 24 : 44);
  const fullName   = (profile as any)?.full_name ?? (profile as any)?.name ?? '';
  const initials   = fullName
    ? fullName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'MO';

  useEffect(() => {
    if (profile && !hasAddress) {
      const t = setTimeout(() => setAddrPopup(true), 600);
      return () => clearTimeout(t);
    }
  }, [profile?.id]);

  // ── Compteur notifications non lues (temps réel) ─────────────────────────
  const userId = (profile as any)?.id ?? null;
  useEffect(() => {
    if (!userId) return;
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)
      .then(({ count }) => setUnreadNotifs(count ?? 0));

    const channelName = `home-notifs-${userId}`;
    const existing = supabase.getChannels().find(c => c.topic === `realtime:${channelName}`);
    if (existing) supabase.removeChannel(existing);

    const ch = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => {
        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_read', false)
          .then(({ count }) => setUnreadNotifs(count ?? 0));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  // ── Businesses ────────────────────────────────────────────────────────────
  // NOTE: on ne filtre PAS par country_code côté DB car les boutiques existantes
  // n'ont pas forcément ce champ rempli. Le filtre distance (20 km) gère la localité.
  const countryCode = (profile as any)?.country_code ?? null;
  const baseFilters = {
    ...(selCat ? { category: selCat } : {}),
  };

  // Une seule requête : tout le pays, filtrage côté client
  const { data: allCountryBiz = [], isLoading } = useBusinesses(baseFilters);

  // Coordonnées de livraison de l'utilisateur (depuis son profil)
  const deliveryLat = (profile as any)?.delivery_lat ?? userLat ?? null;
  const deliveryLon = (profile as any)?.delivery_lon ?? userLon ?? null;

  // Résoudre les coordonnées d'une ville à partir de son nom via ALL_CITIES
  const resolveCityCoords = useCallback((cityName: string): { lat: number; lon: number } | null => {
    const entry = ALL_CITIES.find(c => c.name.toLowerCase() === cityName.toLowerCase());
    if (!entry) return null;
    const lat = (entry as any).lat;
    const lon = (entry as any).lon;
    return (lat && lon) ? { lat, lon } : null;
  }, []);

  // Calculer la distance d'une boutique par rapport à l'utilisateur.
  // Priorité : coordonnées GPS de la boutique.
  // Fallback  : coordonnées de la VILLE de la boutique (via ALL_CITIES).
  const bizDistanceKm = useCallback((b: Business): number | null => {
    if (!deliveryLat || !deliveryLon) return null;
    if (b.latitude && b.longitude) {
      return getDistanceKm(deliveryLat, deliveryLon, b.latitude, b.longitude);
    }
    if (b.city) {
      const cityCoords = resolveCityCoords(b.city);
      if (cityCoords) return getDistanceKm(deliveryLat, deliveryLon, cityCoords.lat, cityCoords.lon);
    }
    return null;
  }, [deliveryLat, deliveryLon, resolveCityCoords]);

  // Businesses "locaux" :
  //   1. Distance calculable (GPS boutique ou coords ville via ALL_CITIES) → ≤ 20 km
  //   2. Distance incalculable (ville inconnue, pas de GPS) :
  //      → même nom de ville que savedCity
  //      OU même nom de ville que savedSuburb
  const businesses = useMemo(() => {
    if (!savedCity && !savedSuburb && !deliveryLat) return allCountryBiz;
    return allCountryBiz.filter(b => {
      const dist = bizDistanceKm(b);
      if (dist !== null) return dist <= 20;
      const bCity = b.city?.toLowerCase() ?? '';
      if (savedCity   && bCity === savedCity.toLowerCase())   return true;
      if (savedSuburb && bCity === savedSuburb.toLowerCase()) return true;
      return false;
    });
  }, [allCountryBiz, savedCity, savedSuburb, deliveryLat, bizDistanceKm]);

  // Empty state : ville/adresse connue + chargé + aucun résultat local
  const isEmptyState = !!(savedCity || deliveryLat) && !isLoading && businesses.length === 0;

  // "En dehors de votre zone" — boutiques entre 15 et 30 km
  const nearbyBizsEmptyState = useMemo(() => {
    if (!isEmptyState) return [];
    const nearby = allCountryBiz.filter(b => {
      const dist = bizDistanceKm(b);
      if (dist !== null) return dist > 15 && dist <= 30;
      return false; // sans coords ni ville connue → on ne l'inclut pas ici
    });
    if (nearby.length > 0) return nearby.slice(0, 20);
    // Fallback ultime : boutiques dont la ville ≠ savedCity
    return allCountryBiz
      .filter(b => b.city?.toLowerCase() !== savedCity?.toLowerCase())
      .slice(0, 20);
  }, [isEmptyState, savedCity, allCountryBiz, bizDistanceKm]);

  // City groups for empty state (cities with 5+ businesses, sorted by count)
  const cityGroups = useMemo(() => {
    if (!isEmptyState) return [];
    const map = new Map<string, Business[]>();
    for (const b of allCountryBiz) {
      const city = b.city ?? '';
      if (!city) continue;
      // Exclure ce qui est déjà affiché en local ou dans "En dehors de votre zone" (≤ 30 km)
      const dist = bizDistanceKm(b);
      if (dist !== null && dist <= 30) continue;
      if (dist === null && savedCity && city.toLowerCase() === savedCity.toLowerCase()) continue;
      if (!map.has(city)) map.set(city, []);
      map.get(city)!.push(b);
    }
    const groups: { city: string; preview: Business[]; all: Business[] }[] = [];
    for (const [city, items] of map.entries()) {
      if (items.length >= 5) {
        groups.push({ city, preview: items.slice(0, 6), all: items });
      }
    }
    return groups.sort((a, b) => b.all.length - a.all.length);
  }, [isEmptyState, savedCity, allCountryBiz]);

  // ── Zones de livraison par boutique ──────────────────────────────────────
  const businessIds = useMemo(
    () => allCountryBiz.map(b => b.id),
    [allCountryBiz],
  );
  const { data: zoneCountMap = new Map<string, ZoneInfo>() } = useQuery<Map<string, ZoneInfo>>({
    queryKey: ['delivery-zone-counts', businessIds.join(',')],
    queryFn: async () => {
      if (businessIds.length === 0) return new Map<string, ZoneInfo>();
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('business_id, label')
        .in('business_id', businessIds)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const map = new Map<string, ZoneInfo>();
      for (const row of data ?? []) {
        const existing = map.get(row.business_id);
        if (existing) {
          existing.count += 1;
        } else {
          map.set(row.business_id, { count: 1, firstLabel: row.label ?? '' });
        }
      }
      return map;
    },
    enabled: businessIds.length > 0,
    staleTime: 60_000,
  });

  const nearbyBizs    = businesses.slice(0, 6);
  const discoverBizs  = businesses.slice(2, 6);
  const exploreBizs   = businesses.length >= 10 ? businesses.slice(6, 10) : [];
  const popularBizs   = [...businesses]
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 6);

  const allPopularBizs = useMemo(
    () => [...businesses].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)),
    [businesses],
  );

  const filteredBizs = useMemo(() => {
    if (!selCat) return [];
    const score = (b: Business): number => {
      const rating = Math.max(1, b.rating ?? 1);
      const distKm = (userLat && userLon && (b as any).latitude && (b as any).longitude)
        ? getDistanceKm(userLat, userLon, (b as any).latitude, (b as any).longitude)
        : 50;
      return rating / (1 + distKm);
    };
    return [...businesses].sort((a, b) => {
      const aS = (a as any).is_sponsored ? 1 : 0;
      const bS = (b as any).is_sponsored ? 1 : 0;
      if (bS !== aS) return bS - aS;
      return score(b) - score(a);
    });
  }, [businesses, selCat, userLat, userLon]);

  const { data: heroBanners = ALL_HERO_BANNERS } = useQuery({
    queryKey: ['hero-banner-counts', cityName],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cityFilter = cityName ? cityName : null;

      let modeQ = supabase.from('businesses').select('id', { count: 'exact', head: true })
        .eq('is_active', true).eq('category', 'mode');
      let restQ = supabase.from('businesses').select('id', { count: 'exact', head: true })
        .eq('is_active', true).eq('category', 'restaurant');
      let newQ  = supabase.from('businesses').select('id', { count: 'exact', head: true })
        .eq('is_active', true).gte('created_at', thirtyDaysAgo.toISOString());

      if (cityFilter) {
        modeQ = modeQ.ilike('city', `%${cityFilter}%`) as typeof modeQ;
        restQ = restQ.ilike('city', `%${cityFilter}%`) as typeof restQ;
        newQ  = newQ.ilike('city',  `%${cityFilter}%`) as typeof newQ;
      }

      const [modeRes, restaurantRes, newRes] = await Promise.all([modeQ, restQ, newQ]);
      const modeCount       = modeRes.count       ?? 0;
      const restaurantCount = restaurantRes.count  ?? 0;
      const newCount        = newRes.count         ?? 0;

      return ALL_HERO_BANNERS.filter(b => {
        if (b.id === 'mode')       return modeCount >= 20;
        if (b.id === 'restaurant') return restaurantCount >= 20;
        if (b.id === 'nouveautes') return newCount >= 7;
        return false;
      });
    },
    staleTime: 5 * 60_000,
  });

  const { data: catalogItems = [] } = useQuery<ServiceWithBusiness[]>({
    queryKey: ['home-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*, business:businesses(name, cover_url, category_icon)')
        .eq('is_available', true)
        .not('price', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as ServiceWithBusiness[];
    },
    staleTime: 60_000,
  });

  const { data: bookableServices = [] } = useQuery<ServiceWithBusiness[]>({
    queryKey: ['home-services'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*, business:businesses(name, cover_url, category_icon)')
        .eq('is_available', true)
        .eq('allows_booking', true)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as ServiceWithBusiness[];
    },
    staleTime: 60_000,
  });

  return (
    <View style={g.root}>

      {/* ── HEADER ── */}
      <View style={[g.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={g.locWrap} onPress={() => setLocationPickerVisible(true)} activeOpacity={0.75}>
          <Feather name="map-pin" size={14} color={ORANGE} style={{ marginRight: 6 }} />
          <View style={{ flex: 1 }}>
            <Text style={g.locLabel}>Livraison à</Text>
            <View style={g.locValue}>
              <Text style={g.locCity} numberOfLines={1}>
                {savedSuburb && savedCity
                  ? `${savedSuburb}, ${savedCity}`
                  : savedLabel && savedCity && savedLabel !== savedCity
                    ? `${savedLabel}, ${savedCity}`
                    : savedLabel || savedCity || 'Définir une adresse'}
              </Text>
              <Feather name="chevron-down" size={14} color={DARK} />
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={g.iconBtn} onPress={() => router.push('/(client)/favorites' as any)} activeOpacity={0.75}>
          <Feather name="heart" size={20} color={DARK} />
        </TouchableOpacity>

        <TouchableOpacity style={[g.iconBtn, { marginLeft: 8 }]} onPress={() => router.push('/(client)/notifications' as any)} activeOpacity={0.75}>
          <Feather name="bell" size={20} color={DARK} />
          {unreadNotifs > 0 && <View style={g.bellDot} />}
        </TouchableOpacity>
      </View>

      {/* ── SCROLL ── */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: (Platform.OS === 'ios' ? insets.bottom : 12) + 80 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: H_PAD, marginTop: 22, marginBottom: 18 }}>
          <Text style={g.title}>{`Qu'est-ce qui vous\nferait plaisir aujourd'hui ?`}</Text>
        </View>

        <TouchableOpacity
          style={[g.search, { marginHorizontal: H_PAD, marginBottom: 24 }]}
          onPress={() => router.push('/(client)/search')}
          activeOpacity={0.85}
        >
          <Feather name="search" size={17} color="#9CA3AF" style={{ marginRight: 8 }} />
          <Text style={g.searchPh}>Rechercher un service, commerce...</Text>
          <View style={g.searchFilter}>
            <Feather name="sliders" size={15} color={DARK} />
          </View>
        </TouchableOpacity>

        <CountryMismatchWarning />

        {/* ── CATÉGORIES ── */}
        <View style={{ paddingHorizontal: H_PAD, marginBottom: 24 }}>
          <SecHeader title="Catégories" linkLabel="Voir tout" onPress={() => router.push('/(client)/search')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
            {HOME_CATS.map(cat => {
              const active = selCat === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={cat_s.item}
                  onPress={() => setSelCat(active ? null : cat.id)}
                >
                  <View style={[cat_s.iconBox, { backgroundColor: active ? ORANGE : cat.bg }]}>
                    <Image
                      source={CAT_ICONS[cat.id]}
                      style={{ width: 30, height: 30 }}
                      resizeMode="contain"
                    />
                  </View>
                  <Text style={[cat_s.label, active && cat_s.labelActive]}>{cat.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── VUE FILTRÉE PAR CATÉGORIE ── */}
        {selCat ? (
          <View style={{ paddingHorizontal: H_PAD, marginBottom: 28 }}>
            <View style={filt.bar}>
              <Text style={filt.count}>
                {isLoading ? '…' : `${filteredBizs.length} résultat${filteredBizs.length !== 1 ? 's' : ''}`}
              </Text>
              <TouchableOpacity style={filt.resetBtn} onPress={() => setSelCat(null)} activeOpacity={0.8}>
                <Feather name="x" size={13} color={DARK} />
                <Text style={filt.resetTxt}>Réinitialiser</Text>
              </TouchableOpacity>
            </View>
            {isLoading ? (
              <View style={{ gap: 14 }}>
                <View style={[g.skeleton, { width: '100%', height: 220 }]} />
                <View style={[g.skeleton, { width: '100%', height: 220 }]} />
              </View>
            ) : filteredBizs.length > 0 ? (
              filteredBizs.map(b => (
                <DiscoverCard key={b.id} b={b} userLat={userLat} userLon={userLon} zoneInfo={zoneCountMap.get(b.id)} />
              ))
            ) : (
              <View style={g.empty}>
                <Feather name="search" size={44} color="#D1D5DB" />
                <Text style={g.emptyTxt}>Aucun commerce dans cette catégorie</Text>
              </View>
            )}
          </View>
        ) : (
          <>
            {!isEmptyState && heroBanners.length > 0 && (
              <View style={{ paddingHorizontal: H_PAD }}>
                <HeroBanner banners={heroBanners} />
              </View>
            )}

            {!isEmptyState && (nearbyBizs.length > 0 || isLoading) && (
              <View style={{ marginBottom: 28 }}>
                <View style={{ paddingHorizontal: H_PAD }}>
                  <SecHeader
                    title="Près de Chez vous"
                    linkLabel="Voir tout"
                    onPress={() => setSectionModal({
                      kind: 'businesses',
                      title: 'Près de Chez vous',
                      items: businesses,
                      userLat,
                      userLon,
                    })}
                  />
                </View>
                {isLoading ? (
                  <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: H_PAD }}>
                    <View style={g.skeleton} /><View style={g.skeleton} />
                  </View>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: H_PAD, paddingVertical: 8, gap: 12 }}>
                    {nearbyBizs.map((b, i) => (
                      <NearbyCard key={b.id} b={b} userLat={userLat} userLon={userLon} idx={i} zoneInfo={zoneCountMap.get(b.id)} />
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

            {!isEmptyState && catalogItems.length > 0 && (
              <View style={{ marginBottom: 28 }}>
                <View style={{ paddingHorizontal: H_PAD }}>
                  <SecHeader
                    title="Offres du moment"
                    onPress={() => setSectionModal({
                      kind: 'offers',
                      title: 'Offres du moment',
                      items: catalogItems,
                    })}
                  />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: H_PAD, gap: 10 }}>
                  {catalogItems.slice(0, 6).map(item => <OfferCard key={item.id} item={item} />)}
                </ScrollView>
              </View>
            )}

            {!isEmptyState && popularBizs.length > 0 && (
              <View style={{ marginBottom: 28 }}>
                <View style={{ paddingHorizontal: H_PAD }}>
                  <SecHeader
                    title="Les plus populaires"
                    onPress={() => setSectionModal({
                      kind: 'businesses',
                      title: 'Les plus populaires',
                      items: allPopularBizs,
                      userLat,
                      userLon,
                    })}
                  />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: H_PAD, gap: 12 }}>
                  {popularBizs.map(b => <PopularCard key={b.id} b={b} />)}
                </ScrollView>
              </View>
            )}

            {!isEmptyState && discoverBizs.length > 0 && (
              <View style={{ paddingHorizontal: H_PAD, marginBottom: 28 }}>
                <SecHeader
                  title="Cela pourrait vous intéresser"
                  onPress={() => setSectionModal({
                    kind: 'businesses',
                    title: 'Cela pourrait vous intéresser',
                    items: businesses.slice(2),
                    userLat,
                    userLon,
                  })}
                />
                {discoverBizs.map(b => (
                  <DiscoverCard key={b.id} b={b} userLat={userLat} userLon={userLon} zoneInfo={zoneCountMap.get(b.id)} />
                ))}
              </View>
            )}

            {isEmptyState ? (
              <>
                {/* Message zone vide */}
                <View style={{ paddingHorizontal: H_PAD, marginBottom: 28 }}>
                  <View style={ez.box}>
                    <Text style={ez.emoji}>🏙️</Text>
                    <Text style={ez.title}>Aucun commerce encore enregistré dans votre zone</Text>
                    <Text style={ez.sub}>Soyez le premier à ouvrir votre boutique à {savedCity ?? 'votre ville'} !</Text>
                  </View>
                </View>

                {/* En dehors de votre zone */}
                {nearbyBizsEmptyState.length > 0 && (
                  <View style={{ marginBottom: 28 }}>
                    <View style={{ paddingHorizontal: H_PAD }}>
                      <SecHeader
                        title="En dehors de votre zone"
                        onPress={() => setSectionModal({
                          kind: 'businesses',
                          title: 'En dehors de votre zone',
                          items: nearbyBizsEmptyState,
                          userLat,
                          userLon,
                        })}
                      />
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: H_PAD, paddingVertical: 8, gap: 12 }}>
                      {nearbyBizsEmptyState.slice(0, 6).map((b, i) => (
                        <NearbyCard key={b.id} b={b} userLat={userLat} userLon={userLon} idx={i} zoneInfo={zoneCountMap.get(b.id)} />
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Seller Banner */}
                <View style={{ paddingHorizontal: H_PAD, marginBottom: 28 }}>
                  <SellerBanner />
                </View>

                {/* Listes par ville (5+ commerces) */}
                {cityGroups.map(({ city, preview, all }) => (
                  <View key={city} style={{ marginBottom: 28 }}>
                    <View style={{ paddingHorizontal: H_PAD }}>
                      <SecHeader
                        title={city}
                        onPress={() => setSectionModal({
                          kind: 'businesses',
                          title: city,
                          items: all,
                          userLat,
                          userLon,
                          searchable: true,
                        })}
                      />
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: H_PAD, paddingVertical: 8, gap: 12 }}>
                      {preview.map((b, i) => (
                        <NearbyCard key={b.id} b={b} userLat={userLat} userLon={userLon} idx={i} zoneInfo={zoneCountMap.get(b.id)} />
                      ))}
                    </ScrollView>
                  </View>
                ))}
              </>
            ) : (
              <>
                {!isLoading && businesses.length === 0 && (
                  <View style={g.empty}>
                    <Feather name="search" size={44} color="#D1D5DB" />
                    <Text style={g.emptyTxt}>Aucun commerce dans cette ville</Text>
                  </View>
                )}

                <View style={{ paddingHorizontal: H_PAD }}>
                  <SellerBanner />
                </View>

                {bookableServices.length > 0 && (
                  <View style={{ marginBottom: 28 }}>
                    <View style={{ paddingHorizontal: H_PAD }}>
                      <SecHeader
                        title="Besoin d'un service ?"
                        onPress={() => setSectionModal({
                          kind: 'services',
                          title: "Besoin d'un service ?",
                          items: bookableServices,
                        })}
                      />
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: H_PAD, gap: 12 }}>
                      {bookableServices.slice(0, 6).map(sv => <ServiceCard key={sv.id} item={sv} />)}
                    </ScrollView>
                  </View>
                )}

                {exploreBizs.length > 0 && (
                  <View style={{ paddingHorizontal: H_PAD, marginBottom: 16 }}>
                    <SecHeader
                      title="Explorez"
                      onPress={() => setSectionModal({
                        kind: 'businesses',
                        title: 'Explorez',
                        items: businesses.slice(6),
                        userLat,
                        userLon,
                      })}
                    />
                    {exploreBizs.map(b => (
                      <DiscoverCard key={b.id} b={b} userLat={userLat} userLon={userLon} zoneInfo={zoneCountMap.get(b.id)} />
                    ))}
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* ── Modals ── */}
      <LocationPickerModal visible={locationPickerVisible} onClose={() => setLocationPickerVisible(false)} />
      <SectionListModal data={sectionModal} onClose={() => setSectionModal(null)} zoneCountMap={zoneCountMap} />

      <Modal visible={addrPopup && !hasAddress} transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
        <View style={g.popupBg}>
          <View style={g.popupCard}>
            <View style={g.popupIcon}><Text style={{ fontSize: 44 }}>📍</Text></View>
            <Text style={g.popupTitle}>Définissez votre adresse</Text>
            <Text style={g.popupSub}>Pour voir les commerces disponibles près de chez vous, nous avons besoin de votre adresse de livraison.</Text>
            <TouchableOpacity
              style={g.popupBtn}
              onPress={() => { setAddrPopup(false); setLocationPickerVisible(true); }}
              activeOpacity={0.88}
            >
              <Feather name="map-pin" size={18} color={WHITE} />
              <Text style={g.popupBtnTxt}>Définir mon adresse de livraison</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles globaux ─────────────────────────────────────────────────────────────
const g = StyleSheet.create({
  root:         { flex: 1, backgroundColor: WHITE },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: H_PAD, paddingBottom: 14, backgroundColor: WHITE },
  locWrap:      { flex: 1, flexDirection: 'row', alignItems: 'center' },
  locLabel:     { fontSize: 10, color: '#94948E', marginBottom: 2 },
  locValue:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locCity:      { fontSize: 14, fontWeight: '800', color: DARK, maxWidth: W * 0.52 },
  iconBtn:      { position: 'relative', width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#ECECE8', alignItems: 'center', justifyContent: 'center' },
  bellDot:      { position: 'absolute', top: 5, right: 5, width: 8, height: 8, borderRadius: 4, backgroundColor: ORANGE, borderWidth: 1.5, borderColor: WHITE },
  title:        { fontSize: 26, fontWeight: '800', color: DARK, lineHeight: 34 },
  search:       { flexDirection: 'row', alignItems: 'center', backgroundColor: GRAY_LT, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 },
  searchPh:     { flex: 1, fontSize: 14, color: '#9CA3AF' },
  searchFilter: { padding: 4 },
  secHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  secTitle:     { fontSize: 18, fontWeight: '800', color: DARK },
  seeAll:       { fontSize: 13, fontWeight: '600', color: ORANGE },
  skeleton:     { width: W * 0.72, height: 220, borderRadius: 23, backgroundColor: GRAY_LT },
  empty:        { alignItems: 'center', gap: 12, paddingVertical: 60 },
  emptyTxt:     { fontSize: 16, color: '#9CA3AF' },
  popupBg:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  popupCard:    { backgroundColor: WHITE, borderRadius: 24, padding: 28, gap: 14, width: '100%', alignItems: 'center' },
  popupIcon:    { width: 80, height: 80, borderRadius: 24, backgroundColor: '#FEF2EC', alignItems: 'center', justifyContent: 'center' },
  popupTitle:   { fontSize: 22, fontWeight: '800', color: DARK, textAlign: 'center' },
  popupSub:     { fontSize: 14, color: GRAY, lineHeight: 20, textAlign: 'center' },
  popupBtn:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: ORANGE, borderRadius: 14, paddingVertical: 15, paddingHorizontal: 20, width: '100%', justifyContent: 'center' },
  popupBtnTxt:  { fontSize: 15, fontWeight: '700', color: WHITE },
});

const cat_s = StyleSheet.create({
  item:          { alignItems: 'center', gap: 7 },
  iconBox:       { width: 58, height: 58, borderRadius: 14, backgroundColor: WHITE, borderWidth: 1.5, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  iconBoxActive: { backgroundColor: DARK, borderColor: DARK },
  label:         { fontSize: 11, color: GRAY, fontWeight: '500', textAlign: 'center' },
  labelActive:   { color: DARK, fontWeight: '700' },
});

const hb = StyleSheet.create({
  card:      { borderRadius: 20, overflow: 'hidden', height: 190, position: 'relative' },
  bgImg:     { ...StyleSheet.absoluteFill },
  overlay:   { ...StyleSheet.absoluteFill },
  content:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, padding: 20, justifyContent: 'center' },
  title:     { fontSize: 22, fontWeight: '900', color: WHITE, lineHeight: 28, marginBottom: 6 },
  sub:       { fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 17, marginBottom: 16 },
  ctaBtn:    { backgroundColor: WHITE, borderRadius: 100, paddingHorizontal: 20, paddingVertical: 11, alignSelf: 'flex-start' },
  ctaTxt:    { fontSize: 13, fontWeight: '800' },
  dots:      { position: 'absolute', bottom: 12, right: 16, flexDirection: 'row', gap: 6 },
  dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { width: 18, backgroundColor: WHITE },
});

const nc = StyleSheet.create({
  card:     { width: W * 0.72, backgroundColor: WHITE, borderRadius: 23, overflow: 'hidden', borderWidth: 1, borderColor: '#ECECE8' },
  imgWrap:  { position: 'relative' },
  img:      { width: '100%', height: 142 },
  badge:    { position: 'absolute', top: 10, left: 10, backgroundColor: ORANGE, borderRadius: 100, paddingHorizontal: 9, paddingVertical: 4 },
  badgeTxt: { fontSize: 10, fontWeight: '800', color: WHITE },
  heart:    { position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 2 },
  body:        { padding: 10, gap: 3 },
  nameRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name:        { fontSize: 13, fontWeight: '700', color: DARK, flex: 1, marginRight: 6 },
  ratingRow:   { flexDirection: 'row', alignItems: 'center', gap: 3 },
  rating:      { fontSize: 12, fontWeight: '700', color: DARK },
  reviewCount: { fontSize: 11, fontWeight: '500', color: GRAY },
  category:    { fontSize: 11, fontWeight: '500', color: GRAY, textTransform: 'capitalize' },
});

const oc = StyleSheet.create({
  card:     { width: 164, backgroundColor: WHITE, borderRadius: 20, overflow: 'hidden' },
  imgWrap:  { position: 'relative' },
  img:      { width: '100%', height: 154 },
  badge:    { position: 'absolute', top: 8, left: 8, backgroundColor: ORANGE, borderRadius: 100, paddingHorizontal: 7, paddingVertical: 3 },
  badgeTxt: { fontSize: 9, fontWeight: '800', color: WHITE },
  name:     { fontSize: 12, fontWeight: '800', color: DARK, marginTop: 10, marginHorizontal: 4 },
  shop:     { fontSize: 9, fontWeight: '600', color: '#9A9A94', marginTop: 4, marginHorizontal: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 4, marginTop: 7, marginBottom: 10 },
  price:    { fontSize: 12, fontWeight: '800', color: DARK },
});

const pc = StyleSheet.create({
  card:        { width: 180, backgroundColor: WHITE },
  imgWrap:     { position: 'relative' },
  img:         { width: '100%', height: 168, borderRadius: 21 },
  statOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.42)', paddingHorizontal: 9, paddingVertical: 6, borderBottomLeftRadius: 21, borderBottomRightRadius: 21 },
  statTxt:     { fontSize: 10, fontWeight: '600', color: WHITE, flex: 1 },
  name:        { fontSize: 13, fontWeight: '800', color: DARK, marginTop: 10, marginHorizontal: 4 },
  sub:         { fontSize: 10, fontWeight: '600', color: '#90908A', marginTop: 4, marginHorizontal: 4 },
});

const dc = StyleSheet.create({
  card:     { backgroundColor: WHITE, borderRadius: 23, overflow: 'hidden', marginBottom: 14, borderWidth: 1, borderColor: '#ECECE8' },
  imgWrap:  { position: 'relative' },
  img:      { width: '100%', height: 142 },
  badge:    { position: 'absolute', top: 12, left: 12, backgroundColor: ORANGE, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5 },
  badgeTxt: { fontSize: 11, fontWeight: '700', color: WHITE },
  heart:    { position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: 16, backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 2 },
  body:       { padding: 14, gap: 3 },
  nameRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  name:       { fontSize: 15, fontWeight: '700', color: DARK, flex: 1, marginRight: 8 },
  ratingRow:  { flexDirection: 'row', alignItems: 'center', gap: 3 },
  rating:     { fontSize: 13, fontWeight: '700', color: DARK },
  category:   { fontSize: 12, fontWeight: '500', color: GRAY, textTransform: 'capitalize', marginBottom: 2 },
});

const svc = StyleSheet.create({
  card:      { width: 205, backgroundColor: WHITE, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: '#ECECE8' },
  imgWrap:   { position: 'relative' },
  img:       { width: '100%', height: 126 },
  timeBadge: { position: 'absolute', bottom: 10, left: 10, backgroundColor: WHITE, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  timeTxt:   { fontSize: 10, fontWeight: '700', color: DARK },
  name:      { fontSize: 13, fontWeight: '700', color: DARK, marginBottom: 3 },
  provider:  { fontSize: 9, fontWeight: '600', color: '#999993', marginBottom: 7 },
  price:     { fontSize: 12, color: ORANGE, fontWeight: '600' },
});

const svf = StyleSheet.create({
  card:     { flexDirection: 'row', backgroundColor: WHITE, borderRadius: 16, overflow: 'hidden', marginBottom: 12, borderWidth: 1, borderColor: '#ECECE8' },
  imgWrap:  { position: 'relative', width: 110 },
  img:      { width: 110, height: 100 },
  timeBadge:{ position: 'absolute', bottom: 8, left: 8, backgroundColor: WHITE, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
  body:     { flex: 1, padding: 12, justifyContent: 'center', gap: 3 },
  name:     { fontSize: 14, fontWeight: '700', color: DARK },
  provider: { fontSize: 11, color: '#999993' },
  price:    { fontSize: 13, color: ORANGE, fontWeight: '700' },
});

const off = StyleSheet.create({
  card:    { flexDirection: 'row', backgroundColor: WHITE, borderRadius: 16, overflow: 'hidden', marginBottom: 12, borderWidth: 1, borderColor: '#ECECE8' },
  imgWrap: { position: 'relative', width: 110 },
  img:     { width: 110, height: 100 },
  body:    { flex: 1, padding: 12, justifyContent: 'center', gap: 3 },
  name:    { fontSize: 14, fontWeight: '700', color: DARK },
  shop:    { fontSize: 11, color: '#9A9A94' },
  price:   { fontSize: 13, fontWeight: '800', color: DARK },
});

const promo = StyleSheet.create({
  card:        { minHeight: 205, borderRadius: 27, padding: 24, overflow: 'hidden', position: 'relative' },
  circleOuter: { position: 'absolute', width: 200, height: 200, borderRadius: 100, borderWidth: 30, borderColor: 'rgba(255,255,255,0.06)', right: -60, top: 20 },
  circleInner: { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 20, borderColor: 'rgba(255,255,255,0.06)', right: -10, top: 70 },
  tag:         { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 1, marginBottom: 8 },
  title:       { fontSize: 22, fontWeight: '900', color: WHITE, lineHeight: 28, marginBottom: 8, maxWidth: '75%' as any },
  sub:         { fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 18, marginBottom: 20, maxWidth: '70%' as any },
  cta:         { borderRadius: 100, paddingHorizontal: 22, paddingVertical: 13, alignSelf: 'flex-start' },
  ctaTxt:      { fontSize: 14, fontWeight: '800', color: WHITE },
});

const filt = StyleSheet.create({
  bar:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  count:    { fontSize: 14, fontWeight: '700', color: DARK },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: GRAY_LT, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 7 },
  resetTxt: { fontSize: 12, fontWeight: '600', color: DARK },
});

const sh = StyleSheet.create({
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'nowrap' },
  openTxt:   { fontSize: 12, fontWeight: '700', color: TEAL },
  dot:       { fontSize: 12, color: '#D1D5DB', marginHorizontal: 1 },
  meta:      { fontSize: 12, color: GRAY },
  promoTxt:  { fontSize: 11, fontWeight: '700', color: '#EF4444', marginLeft: 4 },
});

// ── Styles DeliveryRow ────────────────────────────────────────────────────────
const dlv = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  available: { fontSize: 11, fontWeight: '600', color: '#22C55E' },
});

const slm = StyleSheet.create({
  root:        { flex: 1, backgroundColor: WHITE },
  header:      {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB',
  },
  backBtn:     { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title:       { fontSize: 17, fontWeight: '800', color: DARK },
  list:        { padding: 16, paddingBottom: 40 },
  empty:       { alignItems: 'center', gap: 12, paddingVertical: 80 },
  emptyTxt:    { fontSize: 16, color: '#9CA3AF' },
  searchWrap:  { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 10, backgroundColor: '#F5F5F5', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  searchInput: { flex: 1, fontSize: 14, color: DARK },
});

const ez = StyleSheet.create({
  box:   { backgroundColor: '#FFF7ED', borderRadius: 20, padding: 24, alignItems: 'center', gap: 10 },
  emoji: { fontSize: 44 },
  title: { fontSize: 17, fontWeight: '800', color: DARK, textAlign: 'center', lineHeight: 24 },
  sub:   { fontSize: 13, color: GRAY, textAlign: 'center', lineHeight: 19 },
});
