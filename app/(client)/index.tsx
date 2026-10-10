/**
 * app/(client)/index.tsx — Page d'accueil
 * Design fidèle aux maquettes fournies — données 100 % Supabase
 */
import { Feather, Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  Animated, Dimensions, FlatList, Image, Modal, Platform, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { useCartStore } from '@/stores/cartStore';
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

// ── Catégories homepage (sans "Tout") ─────────────────────────────────────────
const HOME_CATS = [
  { id: 'restaurant',  label: 'Restaurants', icon: 'coffee'       },
  { id: 'mode',        label: 'Mode',        icon: 'shopping-bag' },
  { id: 'beaute',      label: 'Beauté',      icon: 'user'         },
  { id: 'maison',      label: 'Maison',      icon: 'home'         },
  { id: 'ouvrier',     label: 'Services',    icon: 'settings'     },
] as const;

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

// ── Type modal section ─────────────────────────────────────────────────────────
type SectionModalData =
  | { kind: 'businesses'; title: string; items: Business[];            userLat?: number|null; userLon?: number|null }
  | { kind: 'offers';     title: string; items: ServiceWithBusiness[] }
  | { kind: 'services';   title: string; items: ServiceWithBusiness[] }
  | null;

// ── Helpers ────────────────────────────────────────────────────────────────────
function getBadgeLabel(b: Business): string {
  if ((b.rating ?? 0) >= 4.8)                              return 'Très apprécié';
  if (b.category?.toLowerCase().includes('artisan'))        return 'Créateur local';
  if (b.has_delivery)                                       return 'Livraison offerte';
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
function StatusRow({ open, time, reviews }: { open: boolean; time?: string; reviews?: number }) {
  return (
    <View style={sh.statusRow}>
      <Text style={[sh.openTxt, !open && { color: '#EF4444' }]}>{open ? 'Ouvert' : 'Fermé'}</Text>
      {time != null && <><Text style={sh.dot}>·</Text><Text style={sh.meta}>{time}</Text></>}
      <Text style={sh.dot}>·</Text>
      <Text style={sh.meta}>{reviews ?? 0} avis</Text>
    </View>
  );
}

// ── NearbyCard ─────────────────────────────────────────────────────────────────
function NearbyCard({ b, userLat, userLon, idx }: { b: Business; userLat?: number|null; userLon?: number|null; idx: number }) {
  const [fav, setFav] = useState(false);
  const open  = isBusinessOpen(b.hours, (b as any).timezone);
  const dist  = (userLat && userLon && (b as any).latitude && (b as any).longitude)
    ? formatDistance(getDistanceKm(userLat, userLon, (b as any).latitude, (b as any).longitude))
    : null;
  const badge = b.has_delivery ? 'Livraison offerte' : idx === 0 ? 'Proche de vous' : null;

  return (
    <TouchableOpacity
      style={nc.card}
      onPress={() => router.push({ pathname: '/(client)/business/[id]', params: { id: b.id } })}
      activeOpacity={0.88}
    >
      <View style={nc.imgWrap}>
        <CoverPhoto uri={b.cover_url} style={nc.img} emoji={b.category_icon} />
        {badge && <View style={nc.badge}><Text style={nc.badgeTxt}>{badge}</Text></View>}
        <TouchableOpacity style={nc.heart} onPress={() => setFav(f => !f)}>
          <Ionicons name={fav ? 'heart' : 'heart-outline'} size={15} color={fav ? ORANGE : '#374151'} />
        </TouchableOpacity>
        {!b.has_delivery && (
          <View style={nc.noDelivery}>
            <Feather name="truck" size={10} color="#EF4444" />
            <Text style={nc.noDeliveryTxt}>Pas de livraison</Text>
          </View>
        )}
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
        <StatusRow open={open} time={dist ?? undefined} reviews={b.review_count} />
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
      onPress={() => router.push('/(client)/search')}
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
function DiscoverCard({ b, userLat, userLon }: { b: Business; userLat?: number|null; userLon?: number|null }) {
  const [fav, setFav] = useState(false);
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
        <TouchableOpacity style={dc.heart} onPress={() => setFav(f => !f)}>
          <Ionicons name={fav ? 'heart' : 'heart-outline'} size={15} color={fav ? ORANGE : '#374151'} />
        </TouchableOpacity>
        {!b.has_delivery && (
          <View style={dc.noDelivery}>
            <Feather name="truck" size={10} color="#EF4444" />
            <Text style={dc.noDeliveryTxt}>Pas de livraison</Text>
          </View>
        )}
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
        <StatusRow open={open} time={dist ?? undefined} reviews={b.review_count} />
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
      onPress={() => router.push('/(client)/search')}
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
            ? `Dès ${item.price.toLocaleString('fr-FR')} ${item.currency ?? 'FCFA'}`
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
      onPress={() => router.push('/(client)/search')}
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
      onPress={() => router.push('/(client)/search')}
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
function SectionListModal({ data, onClose }: { data: SectionModalData; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  if (!data) return null;

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

        {/* Contenu */}
        {data.kind === 'businesses' && (
          data.items.length === 0 ? renderEmpty() : (
            <FlatList
              data={data.items}
              keyExtractor={item => item.id}
              contentContainerStyle={slm.list}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <DiscoverCard b={item} userLat={data.userLat} userLon={data.userLon} />
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
  const savedCity     = (locationStore as any).city    ?? null;
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
  const cityEntry  = ALL_CITIES.find(c => c.name.toLowerCase() === (cityName ?? '').toLowerCase()) ?? null;
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

    // Retirer l'éventuel ancien channel du même nom avant de re-souscrire
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
  const countryCode = (profile as any)?.country_code ?? null;
  const bizFilters  = {
    ...(countryCode ? { country_code: countryCode } : {}),
    ...(selCat      ? { category: selCat }          : {}),
  };
  const { data: businesses = [], isLoading } = useBusinesses(bizFilters);

  const nearbyBizs    = businesses.slice(0, 6);
  const discoverBizs  = businesses.slice(2, 6);
  const exploreBizs   = businesses.length >= 10 ? businesses.slice(6, 10) : [];
  const popularBizs   = [...businesses]
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 6);

  // Liste complète pour les modals
  const allPopularBizs = useMemo(
    () => [...businesses].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)),
    [businesses],
  );

  // ── Liste filtrée par catégorie ──────────────────────────────────────────────
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

  // ── Comptage dynamique des boutiques par ville pour les bannières hero ───────
  const { data: heroBanners = ALL_HERO_BANNERS } = useQuery({
    queryKey: ['hero-banner-counts', cityName],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const cityFilter = cityName ? cityName : null;

      // Construit les queries de manière conditionnelle
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
    staleTime: 5 * 60_000, // 5 minutes
  });

  // ── Catalogue ──────────────────────────────────────────────────────────────
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

  // ── Services réservables ──────────────────────────────────────────────────
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
                {savedLabel && savedCity
                  ? `${savedLabel}, ${savedCity}`
                  : savedLabel
                    ? savedLabel
                    : savedCity
                      ? savedCity
                      : 'Définir une adresse'}
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
                  <View style={[cat_s.iconBox, active && cat_s.iconBoxActive]}>
                    <Feather name={cat.icon as any} size={20} color={active ? WHITE : DARK} />
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
                <DiscoverCard key={b.id} b={b} userLat={userLat} userLon={userLon} />
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
            {/* ── HERO BANNER (conditionnel selon les commerces en ville) ── */}
            {heroBanners.length > 0 && (
              <View style={{ paddingHorizontal: H_PAD }}>
                <HeroBanner banners={heroBanners} />
              </View>
            )}

            {/* ── PRÈS DE CHEZ VOUS ── */}
            {(nearbyBizs.length > 0 || isLoading) && (
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
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: H_PAD, gap: 12 }}>
                    {nearbyBizs.map((b, i) => (
                      <NearbyCard key={b.id} b={b} userLat={userLat} userLon={userLon} idx={i} />
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

            {/* ── OFFRES DU MOMENT ── */}
            {catalogItems.length > 0 && (
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

            {/* ── LES PLUS POPULAIRES ── */}
            {popularBizs.length > 0 && (
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

            {/* ── CELA POURRAIT VOUS INTÉRESSER ── */}
            {discoverBizs.length > 0 && (
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
                  <DiscoverCard key={b.id} b={b} userLat={userLat} userLon={userLon} />
                ))}
              </View>
            )}

            {/* État vide */}
            {!isLoading && businesses.length === 0 && (
              <View style={g.empty}>
                <Feather name="search" size={44} color="#D1D5DB" />
                <Text style={g.emptyTxt}>Aucun commerce dans cette ville</Text>
              </View>
            )}

            {/* ── BANNIÈRE COMMERÇANT ── */}
            <View style={{ paddingHorizontal: H_PAD }}>
              <SellerBanner />
            </View>

            {/* ── BESOIN D'UN SERVICE ? ── */}
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

            {/* ── EXPLOREZ ── */}
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
                  <DiscoverCard key={b.id} b={b} userLat={userLat} userLon={userLon} />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>


      {/* ── Modals ── */}
      <LocationPickerModal visible={locationPickerVisible} onClose={() => setLocationPickerVisible(false)} />

      <SectionListModal data={sectionModal} onClose={() => setSectionModal(null)} />

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
  card:     { width: W * 0.72, backgroundColor: WHITE, borderRadius: 23, overflow: 'hidden', borderWidth: 1, borderColor: '#ECECE8', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  imgWrap:  { position: 'relative' },
  img:      { width: '100%', height: 142 },
  badge:    { position: 'absolute', top: 10, left: 10, backgroundColor: ORANGE, borderRadius: 100, paddingHorizontal: 9, paddingVertical: 4 },
  badgeTxt: { fontSize: 10, fontWeight: '800', color: WHITE },
  heart:          { position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: WHITE, borderWidth: 1.5, borderColor: '#374151', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  noDelivery:     { position: 'absolute', bottom: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#FECACA' },
  noDeliveryTxt:  { fontSize: 9, fontWeight: '700', color: '#EF4444' },
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
  card:     { backgroundColor: WHITE, borderRadius: 23, overflow: 'hidden', marginBottom: 14, borderWidth: 1, borderColor: '#ECECE8', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  imgWrap:  { position: 'relative' },
  img:      { width: '100%', height: 142 },
  badge:    { position: 'absolute', top: 12, left: 12, backgroundColor: ORANGE, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5 },
  badgeTxt: { fontSize: 11, fontWeight: '700', color: WHITE },
  heart:          { position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: 16, backgroundColor: WHITE, borderWidth: 1.5, borderColor: '#374151', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  noDelivery:     { position: 'absolute', bottom: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 100, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: '#FECACA' },
  noDeliveryTxt:  { fontSize: 10, fontWeight: '700', color: '#EF4444' },
  body:       { padding: 14, gap: 3 },
  nameRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  name:       { fontSize: 15, fontWeight: '700', color: DARK, flex: 1, marginRight: 8 },
  ratingRow:  { flexDirection: 'row', alignItems: 'center', gap: 3 },
  rating:     { fontSize: 13, fontWeight: '700', color: DARK },
  category:   { fontSize: 12, fontWeight: '500', color: GRAY, textTransform: 'capitalize', marginBottom: 4 },
});

const svc = StyleSheet.create({
  card:      { width: 205, backgroundColor: WHITE, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: '#ECECE8', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  imgWrap:   { position: 'relative' },
  img:       { width: '100%', height: 126 },
  timeBadge: { position: 'absolute', bottom: 10, left: 10, backgroundColor: WHITE, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  timeTxt:   { fontSize: 10, fontWeight: '700', color: DARK },
  name:      { fontSize: 13, fontWeight: '700', color: DARK, marginBottom: 3 },
  provider:  { fontSize: 9, fontWeight: '600', color: '#999993', marginBottom: 7 },
  price:     { fontSize: 12, color: ORANGE, fontWeight: '600' },
});

// ── Styles plein-largeur (modal) ──────────────────────────────────────────────
const svf = StyleSheet.create({
  card:     { flexDirection: 'row', backgroundColor: WHITE, borderRadius: 16, overflow: 'hidden', marginBottom: 12, borderWidth: 1, borderColor: '#ECECE8', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  imgWrap:  { position: 'relative', width: 110 },
  img:      { width: 110, height: 100 },
  timeBadge:{ position: 'absolute', bottom: 8, left: 8, backgroundColor: WHITE, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
  body:     { flex: 1, padding: 12, justifyContent: 'center', gap: 3 },
  name:     { fontSize: 14, fontWeight: '700', color: DARK },
  provider: { fontSize: 11, color: '#999993' },
  price:    { fontSize: 13, color: ORANGE, fontWeight: '700' },
});

const off = StyleSheet.create({
  card:    { flexDirection: 'row', backgroundColor: WHITE, borderRadius: 16, overflow: 'hidden', marginBottom: 12, borderWidth: 1, borderColor: '#ECECE8', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
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
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  openTxt:   { fontSize: 12, fontWeight: '700', color: TEAL },
  dot:       { fontSize: 12, color: '#D1D5DB', marginHorizontal: 1 },
  meta:      { fontSize: 12, color: GRAY },
});

// ── Styles modal liste ────────────────────────────────────────────────────────
const slm = StyleSheet.create({
  root:    { flex: 1, backgroundColor: WHITE },
  header:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB',
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title:   { fontSize: 17, fontWeight: '800', color: DARK },
  list:    { padding: 16, paddingBottom: 40 },
  empty:   { alignItems: 'center', gap: 12, paddingVertical: 80 },
  emptyTxt:{ fontSize: 16, color: '#9CA3AF' },
});
