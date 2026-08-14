// app/(pro)/business/[id].tsx
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Dimensions,
  Platform, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBusiness } from '@/hooks/useBusinesses';
import { buildBusinessTag } from '@/lib/businessTag';

// ── Sections séparées ─────────────────────────────────────────────────────────
import { OverviewSection } from '@/components/pro/OverviewSection';
import { HoursSection    } from '@/components/pro/HoursSection';
import { CatalogSection  } from '@/components/pro/CatalogSection';

const { width: W } = Dimensions.get('window');
const DRAWER_W = W * 0.72;

// ── Types ─────────────────────────────────────────────────────────────────────
type Section = 'overview' | 'hours' | 'catalog' | 'orders' | 'bookings' | 'settings';

interface DrawerItem {
  id:    Section;
  icon:  React.ComponentProps<typeof Feather>['name'];
  label: string;
  color: string;
}

const DRAWER_ITEMS: DrawerItem[] = [
  { id: 'overview',  icon: 'home',         label: "Vue d'ensemble",  color: '#FF6835' },
  { id: 'catalog',   icon: 'book-open',    label: 'Catalogue',        color: '#1E3A5F' },
  { id: 'hours',     icon: 'clock',        label: 'Horaires',         color: '#22C55E' },
  { id: 'orders',    icon: 'shopping-bag', label: 'Commandes',        color: '#8B5CF6' },
  { id: 'bookings',  icon: 'calendar',     label: 'Réservations',     color: '#F59E0B' },
  { id: 'settings',  icon: 'settings',     label: 'Paramètres',       color: '#6B7280' },
];

// ── Drawer latéral ────────────────────────────────────────────────────────────
function Drawer({
  open, active, onSelect, onClose,
  businessName, businessTag, categoryIcon,
}: {
  open: boolean; active: Section;
  onSelect: (s: Section) => void; onClose: () => void;
  businessName: string; businessTag: string; categoryIcon: string;
}) {
  const insets = useSafeAreaInsets();
  const slideX = useRef(new Animated.Value(-DRAWER_W)).current;

  React.useEffect(() => {
    Animated.spring(slideX, {
      toValue: open ? 0 : -DRAWER_W,
      tension: 80, friction: 14, useNativeDriver: true,
    }).start();
  }, [open]);

  return (
    <>
      {open && (
        <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 10 }]}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
        </Animated.View>
      )}

      <Animated.View style={[
        drawer.container,
        { transform: [{ translateX: slideX }], paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 },
      ]}>
        {/* Header du drawer */}
        <View style={drawer.header}>
          <View style={drawer.bizEmoji}>
            <Text style={{ fontSize: 26 }}>{categoryIcon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={drawer.bizName} numberOfLines={1}>{businessName}</Text>
            <Text style={drawer.bizTag}>{businessTag}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={drawer.closeBtn}>
            <Feather name="x" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <View style={drawer.divider} />

        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {DRAWER_ITEMS.map((item) => {
            const isActive = active === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[drawer.item, isActive && drawer.itemActive]}
                onPress={() => { onSelect(item.id); onClose(); }}
                activeOpacity={0.8}
              >
                <View style={[drawer.itemIcon, { backgroundColor: item.color + (isActive ? '22' : '12') }]}>
                  <Feather name={item.icon} size={18} color={item.color} />
                </View>
                <Text style={[drawer.itemLabel, isActive && { color: '#111827', fontWeight: '700' }]}>
                  {item.label}
                </Text>
                {isActive && <View style={[drawer.activeDot, { backgroundColor: item.color }]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity style={drawer.backRow} onPress={() => router.back()} activeOpacity={0.8}>
          <Feather name="arrow-left" size={16} color="#9CA3AF" />
          <Text style={drawer.backText}>Retour au dashboard</Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}

// ── Sections Coming Soon ──────────────────────────────────────────────────────
function ComingSoon({ label }: { label: string }) {
  return (
    <View style={cs.wrap}>
      <Text style={cs.emoji}>🔜</Text>
      <Text style={cs.title}>{label}</Text>
      <Text style={cs.sub}>Cette section arrive bientôt.</Text>
    </View>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function BusinessDetailPage() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const topPad = Platform.OS === 'web' ? 67 : insets.top + 12;

  const { data: business, isLoading } = useBusiness(id ?? '');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [section, setSection]       = useState<Section>('overview');

  if (isLoading || !business) {
    return (
      <View style={[styles.root, { paddingTop: topPad, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color="#FF6835" size="large" />
      </View>
    );
  }

  const tag         = (business as any).tag ?? buildBusinessTag(business.name, business.id);
  const activeItem  = DRAWER_ITEMS.find((d) => d.id === section)!;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>

      {/* Topbar */}
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.menuBtn} onPress={() => setDrawerOpen(true)} activeOpacity={0.8}>
          <Feather name="menu" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1, paddingHorizontal: 12 }}>
          <Text style={styles.topbarTitle} numberOfLines={1}>{business.name}</Text>
          <View style={styles.topbarSub}>
            <Feather name={activeItem.icon} size={12} color={activeItem.color} />
            <Text style={[styles.topbarSection, { color: activeItem.color }]}>{activeItem.label}</Text>
          </View>
        </View>
        <Text style={styles.topbarTag}>{tag}</Text>
      </View>

      {/* Sections */}
      <View style={{ flex: 1 }}>
        {section === 'overview' && <OverviewSection businessId={business.id} />}
        {section === 'catalog'   && <CatalogSection businessId={business.id} />}
        {section === 'hours'     && (
          // key force un re-mount propre quand on revient sur Horaires
          <HoursSection key={`hours-${business.id}-${JSON.stringify(business.hours?.length)}`} business={business} />
        )}
        {section === 'orders'    && <ComingSoon label="Commandes" />}
        {section === 'bookings'  && <ComingSoon label="Réservations" />}
        {section === 'settings'  && <ComingSoon label="Paramètres" />}
      </View>

      {/* Drawer */}
      <Drawer
        open={drawerOpen}
        active={section}
        onSelect={(s) => { setSection(s); setDrawerOpen(false); }}
        onClose={() => setDrawerOpen(false)}
        businessName={business.name}
        businessTag={tag}
        categoryIcon={(business as any).category_icon ?? '🏪'}
      />
    </View>
  );
}

// ── Styles drawer ─────────────────────────────────────────────────────────────
const drawer = StyleSheet.create({
  container: { position: 'absolute', left: 0, top: 0, bottom: 0, width: DRAWER_W, backgroundColor: '#fff', zIndex: 20, shadowColor: '#000', shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 16 },
  bizEmoji: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  bizName: { fontSize: 15, fontWeight: '800', color: '#111827' },
  bizTag: { fontSize: 12, fontWeight: '300', color: '#9CA3AF' },
  closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, marginHorizontal: 8, marginVertical: 2 },
  itemActive: { backgroundColor: '#F8F7F4' },
  itemIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  itemLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: '#6B7280' },
  activeDot: { width: 6, height: 6, borderRadius: 3 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  backText: { fontSize: 13, color: '#9CA3AF' },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F7F4' },
  topbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 4 },
  menuBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  topbarTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  topbarSub: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  topbarSection: { fontSize: 12, fontWeight: '600' },
  topbarTag: { fontSize: 12, fontWeight: '300', color: '#9CA3AF' },
});

const cs = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  emoji: { fontSize: 44 },
  title: { fontSize: 17, fontWeight: '700', color: '#374151' },
  sub: { fontSize: 14, color: '#9CA3AF' },
});
