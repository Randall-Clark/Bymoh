import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Animated, Dimensions, Platform, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { useMyBusinesses } from '@/hooks/useBusinesses';
import { buildBusinessTag } from '@/lib/businessTag';
import type { Business } from '@/types';

const { width: W, height: SCREEN_H } = Dimensions.get('window');
const CARD_W   = (W - 52) / 2;
const DRAWER_W = W * 0.75;

// ── Actions rapides ───────────────────────────────────────────────────────────
interface QuickAction {
  icon:   React.ComponentProps<typeof Feather>['name'];
  label:  string;
  color:  string;
  route:  string | null;
  addNew?: boolean;
}

const QUICK_ACTIONS: QuickAction[] = [
  { icon: 'plus-square',  label: 'Ajouter un\nproduit',    color: '#FF6835', route: '/(pro)/catalog/edit'   },
  { icon: 'book-open',    label: 'Voir le\ncatalogue',     color: '#1E3A5F', route: '/(pro)/catalog/index'  },
  { icon: 'clock',        label: 'Gérer les\nhoraires',    color: '#22C55E', route: '/(pro)/hours'          },
  { icon: 'shopping-bag', label: 'Commandes',              color: '#8B5CF6', route: '/(pro)/orders'         },
  { icon: 'calendar',     label: 'Réservations',           color: '#F59E0B', route: '/(pro)/bookings'       },
];

// ── BusinessPickerSheet ───────────────────────────────────────────────────────
function BusinessPickerSheet({
  visible, action, businesses, onSelect, onClose,
}: {
  visible:    boolean;
  action:     QuickAction | null;
  businesses: Business[];
  onSelect:   (biz: Business) => void;
  onClose:    () => void;
}) {
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(SCREEN_H)).current;

  React.useEffect(() => {
    Animated.spring(slideY, {
      toValue: visible ? 0 : SCREEN_H,
      tension: 68, friction: 12, useNativeDriver: true,
    }).start();
  }, [visible]);

  if (!visible || !action) return null;

  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFillObject, {
        backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 30,
        opacity: slideY.interpolate({ inputRange: [0, SCREEN_H], outputRange: [1, 0], extrapolate: 'clamp' }),
      }]}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      <Animated.View style={[ps.sheet, { transform: [{ translateY: slideY }], paddingBottom: insets.bottom + 16, zIndex: 31 }]}>
        <View style={ps.handle} />
        <View style={ps.header}>
          <View style={[ps.actionIcon, { backgroundColor: action.color + '18' }]}>
            <Feather name={action.icon} size={20} color={action.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ps.title}>Choisir une boutique</Text>
            <Text style={ps.sub}>{action.label.replace('\n', ' ')}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={ps.closeBtn}>
            <Feather name="x" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {businesses.map((biz) => {
            const tag = (biz as any).tag ?? buildBusinessTag(biz.name, biz.id);
            return (
              <TouchableOpacity key={biz.id} style={ps.bizRow} onPress={() => { onSelect(biz); onClose(); }} activeOpacity={0.85}>
                <View style={[ps.bizDot, biz.is_active ? ps.dotActive : ps.dotInactive]} />
                <View style={ps.bizEmoji}><Text style={{ fontSize: 20 }}>{biz.category_icon ?? '🏪'}</Text></View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                    <Text style={ps.bizName} numberOfLines={1}>{biz.name}</Text>
                    <Text style={ps.bizTag}>{tag}</Text>
                  </View>
                  <Text style={ps.bizCity}>{biz.city ?? biz.category}</Text>
                </View>
                <Feather name="chevron-right" size={16} color="#D1D5DB" />
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={ps.addRow} onPress={() => { router.push('/(pro)/register/step1' as any); onClose(); }} activeOpacity={0.85}>
            <View style={ps.addIcon}><Feather name="plus" size={20} color="#FF6835" /></View>
            <Text style={ps.addText}>Créer un nouveau commerce</Text>
            <Feather name="chevron-right" size={16} color="#FF6835" />
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </>
  );
}

const ps = StyleSheet.create({
  sheet:      { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  handle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  actionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title:      { fontSize: 16, fontWeight: '800', color: '#111827' },
  sub:        { fontSize: 13, color: '#9CA3AF', marginTop: 1 },
  closeBtn:   { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  bizRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  bizDot:     { width: 8, height: 8, borderRadius: 4 },
  dotActive:  { backgroundColor: '#22C55E' },
  dotInactive:{ backgroundColor: '#E5E7EB' },
  bizEmoji:   { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  bizName:    { fontSize: 15, fontWeight: '700', color: '#111827', flexShrink: 1 },
  bizTag:     { fontSize: 11, fontWeight: '300', color: '#9CA3AF' },
  bizCity:    { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  addRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  addIcon:    { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FEF2EC', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FDDCCA', borderStyle: 'dashed' },
  addText:    { flex: 1, fontSize: 15, fontWeight: '600', color: '#FF6835' },
});

// ── Drawer latéral ────────────────────────────────────────────────────────────
function SideDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
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
      <Animated.View style={[dr.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20, transform: [{ translateX: slideX }] }]}>
        <View style={dr.logoRow}>
          <View style={dr.logo}><Text style={dr.logoText}>B</Text></View>
          <View>
            <Text style={dr.logoTitle}>Bymoh Pro</Text>
            <Text style={dr.logoSub}>Espace marchand</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={dr.closeBtn}>
            <Feather name="x" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <View style={dr.divider} />

        <TouchableOpacity
          style={dr.item}
          onPress={() => { onClose(); router.push('/(pro)/register/step1' as any); }}
          activeOpacity={0.8}
        >
          <View style={[dr.itemIcon, { backgroundColor: '#FEF2EC' }]}>
            <Feather name="plus-circle" size={18} color="#FF6835" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={dr.itemLabel}>Ajouter un commerce</Text>
            <Text style={dr.itemSub}>Créer une nouvelle boutique</Text>
          </View>
          <Feather name="chevron-right" size={14} color="#D1D5DB" />
        </TouchableOpacity>

        <TouchableOpacity
          style={dr.item}
          onPress={() => { onClose(); router.push('/(client)' as any); }}
          activeOpacity={0.8}
        >
          <View style={[dr.itemIcon, { backgroundColor: '#EEF2FF' }]}>
            <Feather name="smartphone" size={18} color="#1E3A5F" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={dr.itemLabel}>Espace client</Text>
            <Text style={dr.itemSub}>Naviguer comme un client</Text>
          </View>
          <Feather name="chevron-right" size={14} color="#D1D5DB" />
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}

const dr = StyleSheet.create({
  container: { position: 'absolute', left: 0, top: 0, bottom: 0, width: DRAWER_W, backgroundColor: '#fff', zIndex: 20, shadowColor: '#000', shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 20, gap: 4 },
  logoRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 16 },
  logo:      { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FF6835', alignItems: 'center', justifyContent: 'center' },
  logoText:  { fontSize: 22, fontWeight: '900', color: '#fff' },
  logoTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  logoSub:   { fontSize: 12, color: '#9CA3AF' },
  closeBtn:  { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  divider:   { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 20, marginBottom: 8 },
  item:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  itemIcon:  { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  itemLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
  itemSub:   { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard principal
// ─────────────────────────────────────────────────────────────────────────────
export default function ProDashboard() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const topPad = Platform.OS === 'web' ? 67 : insets.top + 12;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const { data: businesses = [], isLoading } = useMyBusinesses(profile?.id);
  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<QuickAction | null>(null);
  const [menuVisible,   setMenuVisible]   = useState(false);

  const handleActionPress = (action: QuickAction) => {
    if (!action.route) return;
    if (businesses.length === 0) { router.push('/(pro)/register/step1' as any); return; }
    if (businesses.length === 1) {
      router.push({ pathname: action.route as any, params: { businessId: businesses[0].id } });
      return;
    }
    setPendingAction(action);
    setPickerVisible(true);
  };

  const handleBizSelected = (biz: Business) => {
    if (pendingAction?.route) {
      router.push({ pathname: pendingAction.route as any, params: { businessId: biz.id } });
    }
    setPendingAction(null);
  };

  if (!isLoading && businesses.length === 0) {
    return (
      <View style={[styles.root, styles.emptyRoot, { paddingTop: topPad }]}>
        <View style={styles.emptyIcon}><Feather name="briefcase" size={48} color="#E5E7EB" /></View>
        <Text style={styles.emptyTitle}>Aucun commerce créé</Text>
        <Text style={styles.emptySub}>Créez votre premier commerce pour commencer à vendre sur Bymoh.</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/(pro)/register/step1' as any)} activeOpacity={0.88}>
          <Feather name="plus" size={18} color="#fff" />
          <Text style={styles.createBtnText}>Créer mon premier commerce</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const kpis = [
    { icon: 'shopping-bag' as const, label: 'Commandes',    value: '0',                          color: '#FF6835', bg: '#FEF2EC' },
    { icon: 'calendar'     as const, label: 'Réservations', value: '0',                          color: '#1E3A5F', bg: '#EEF2FF' },
    { icon: 'dollar-sign'  as const, label: 'Revenus',      value: '0 F',                        color: '#22C55E', bg: '#F0FDF4' },
    { icon: 'briefcase'    as const, label: 'Boutiques',    value: businesses.length.toString(), color: '#F59E0B', bg: '#FFFBEB' },
  ];

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>

      {/* Header — sans bande blanche, fond transparent */}
      <View style={styles.header}>
        {/* ☰ Hamburger → drawer latéral */}
        <TouchableOpacity style={styles.hamburger} onPress={() => setDrawerOpen(true)} activeOpacity={0.8}>
          <Feather name="menu" size={24} color="#111827" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Tableau de bord</Text>
          <Text style={styles.headerSub}>Bienvenue, {profile?.name?.split(' ')[0] ?? 'Pro'} 👋</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: botPad + 80 }]}>
        {/* KPIs 2×2 */}
        <View style={styles.kpiGrid}>
          {kpis.map((k) => (
            <View key={k.label} style={[styles.kpiCard, { backgroundColor: k.bg }]}>
              <View style={[styles.kpiIcon, { backgroundColor: k.color + '22' }]}>
                <Feather name={k.icon} size={20} color={k.color} />
              </View>
              <Text style={[styles.kpiValue, { color: k.color }]}>{k.value}</Text>
              <Text style={styles.kpiLabel}>{k.label}</Text>
            </View>
          ))}
        </View>

        {/* Actions rapides */}
        <Text style={styles.sectionTitle}>Actions rapides</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionsRow}>
          {QUICK_ACTIONS.map((a) => (
            <TouchableOpacity key={a.label} style={styles.actionCard} onPress={() => handleActionPress(a)} activeOpacity={0.8}>
              <View style={[styles.actionIcon, { backgroundColor: a.color + '18' }]}>
                <Feather name={a.icon} size={22} color={a.color} />
              </View>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Mes boutiques */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Mes boutiques</Text>
          <View style={styles.countBadge}><Text style={styles.countBadgeText}>{businesses.length}</Text></View>
        </View>

        {businesses.map((biz: Business) => {
          const tag = (biz as any).tag ?? buildBusinessTag(biz.name, biz.id);
          return (
            <TouchableOpacity
              key={biz.id}
              style={styles.bizCard}
              onPress={() => router.push({ pathname: '/(pro)/business/[id]' as any, params: { id: biz.id } })}
              activeOpacity={0.85}
            >
              <View style={[styles.bizStatusBar, biz.is_active ? styles.bizStatusActive : styles.bizStatusInactive]} />
              <View style={styles.bizEmoji}><Text style={{ fontSize: 22 }}>{(biz as any).category_icon ?? '🏪'}</Text></View>
              <View style={styles.bizBody}>
                <View style={styles.bizNameRow}>
                  <Text style={styles.bizName} numberOfLines={1}>{biz.name}</Text>
                  <Text style={styles.bizTag}>{tag}</Text>
                </View>
                <View style={styles.bizMeta}>
                  <Text style={styles.bizCategory}>{(biz as any).category_icon} {biz.category}</Text>
                  {biz.city ? (
                    <View style={styles.bizCityRow}>
                      <Feather name="map-pin" size={11} color="#9CA3AF" />
                      <Text style={styles.bizCity}>{biz.city}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={styles.bizRight}>
                <View style={[styles.bizBadge, biz.is_active ? styles.bizBadgeActive : styles.bizBadgeInactive]}>
                  <Text style={[styles.bizBadgeText, { color: biz.is_active ? '#166534' : '#6B7280' }]}>
                    {biz.is_active ? 'Actif' : 'Inactif'}
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color="#D1D5DB" />
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Drawer latéral ☰ */}
      <SideDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Sélecteur boutique pour actions rapides */}
      <BusinessPickerSheet
        visible={pickerVisible}
        action={pendingAction}
        businesses={businesses}
        onSelect={handleBizSelected}
        onClose={() => { setPickerVisible(false); setPendingAction(null); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:            { flex: 1, backgroundColor: '#F8F7F4' },
  emptyRoot:       { alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 32 },
  emptyIcon:       { width: 100, height: 100, borderRadius: 50, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  emptyTitle:      { fontSize: 20, fontWeight: '800', color: '#111827' },
  emptySub:        { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 22 },
  createBtn:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FF6835', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 24, marginTop: 8 },
  createBtnText:   { fontSize: 15, fontWeight: '700', color: '#fff' },
  // ✅ Header sans fond blanc distinct — intégré dans la page
  header:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 16 },
  hamburger:       { width: 42, height: 42, borderRadius: 13, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerTitle:     { fontSize: 20, fontWeight: '800', color: '#111827' },
  headerSub:       { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  scroll:          { paddingHorizontal: 20, gap: 20 },
  kpiGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpiCard:         { width: CARD_W, borderRadius: 18, padding: 16, gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  kpiIcon:         { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  kpiValue:        { fontSize: 26, fontWeight: '800' },
  kpiLabel:        { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  sectionTitle:    { fontSize: 17, fontWeight: '800', color: '#111827' },
  sectionRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  countBadge:      { backgroundColor: '#FEF2EC', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  countBadgeText:  { fontSize: 12, fontWeight: '700', color: '#FF6835' },
  actionsRow:      { gap: 12, paddingVertical: 4 },
  actionCard:      { alignItems: 'center', gap: 8, width: 80 },
  actionIcon:      { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  actionLabel:     { fontSize: 11, fontWeight: '600', color: '#374151', textAlign: 'center', lineHeight: 15 },
  bizCard:         { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, overflow: 'hidden' },
  bizStatusBar:    { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  bizStatusActive: { backgroundColor: '#22C55E' },
  bizStatusInactive:{ backgroundColor: '#E5E7EB' },
  bizEmoji:        { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  bizBody:         { flex: 1, gap: 4 },
  bizNameRow:      { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  bizName:         { fontSize: 15, fontWeight: '700', color: '#111827', flexShrink: 1 },
  bizTag:          { fontSize: 12, fontWeight: '300', color: '#9CA3AF' },
  bizMeta:         { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bizCategory:     { fontSize: 12, color: '#6B7280' },
  bizCityRow:      { flexDirection: 'row', alignItems: 'center', gap: 3 },
  bizCity:         { fontSize: 12, color: '#9CA3AF' },
  bizRight:        { alignItems: 'center', gap: 8 },
  bizBadge:        { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  bizBadgeActive:  { backgroundColor: '#F0FDF4' },
  bizBadgeInactive:{ backgroundColor: '#F3F4F6' },
  bizBadgeText:    { fontSize: 11, fontWeight: '600' },
});
