/**
 * app/(client)/notifications.tsx — Centre de notifications client
 * Temps réel via Supabase Realtime · auto-nettoyage des lu > 48 h
 */
import { Feather, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Platform, Pressable,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

// ── Tokens ────────────────────────────────────────────────────────────────────
const ORANGE  = '#FF6835';
const DARK    = '#111827';
const GRAY    = '#6B7280';
const GRAY_LT = '#F5F5F5';
const WHITE   = '#FFFFFF';
const H_PAD   = 20;

// ── Types ─────────────────────────────────────────────────────────────────────
type NotifType =
  | 'order'
  | 'purchase'
  | 'promotion'
  | 'booking'
  | 'security'
  | 'news'
  | 'system';

interface Notification {
  id: string;
  user_id: string;
  type: NotifType;
  title: string;
  body: string;
  is_read: boolean;
  related_id?: string | null;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<NotifType, { icon: string; color: string; bg: string; label: string }> = {
  order:     { icon: 'package',       color: '#3B82F6', bg: '#EFF6FF', label: 'Commande'   },
  purchase:  { icon: 'credit-card',   color: '#8B5CF6', bg: '#F5F3FF', label: 'Achat'      },
  promotion: { icon: 'tag',           color: ORANGE,    bg: '#FFF7ED', label: 'Promotion'  },
  booking:   { icon: 'calendar',      color: '#10B981', bg: '#ECFDF5', label: 'Réservation'},
  security:  { icon: 'shield',        color: '#EF4444', bg: '#FEF2F2', label: 'Sécurité'   },
  news:      { icon: 'bell',          color: '#F59E0B', bg: '#FFFBEB', label: 'Nouveauté'  },
  system:    { icon: 'info',          color: GRAY,      bg: GRAY_LT,   label: 'Système'    },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return "À l'instant";
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h} h`;
  return `Il y a ${Math.floor(h / 24)} j`;
}

// Durée après laquelle une notification lue est supprimée (48 h)
const READ_TTL_MS = 48 * 60 * 60 * 1000;

// ── Composant notification individuelle ───────────────────────────────────────
function NotifItem({
  item,
  selected,
  onToggleSelect,
  onPress,
}: {
  item: Notification;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onPress: (item: Notification) => void;
}) {
  const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.system;
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start(() => onPress(item));
  };

  return (
    <Animated.View style={[ns.row, { transform: [{ scale }] }, !item.is_read && ns.rowUnread]}>
      {/* Checkbox sélection */}
      <Pressable style={ns.checkWrap} onPress={() => onToggleSelect(item.id)}>
        <View style={[ns.check, selected && ns.checkActive]}>
          {selected && <Feather name="check" size={11} color={WHITE} />}
        </View>
      </Pressable>

      {/* Corps cliquable */}
      <TouchableOpacity style={ns.body} onPress={handlePress} activeOpacity={0.8}>
        {/* Icône type */}
        <View style={[ns.iconBox, { backgroundColor: cfg.bg }]}>
          <Feather name={cfg.icon as any} size={17} color={cfg.color} />
        </View>

        <View style={ns.text}>
          <View style={ns.titleRow}>
            <Text style={[ns.title, !item.is_read && ns.titleBold]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={ns.time}>{timeAgo(item.created_at)}</Text>
          </View>
          <Text style={ns.bodyTxt} numberOfLines={2}>{item.body}</Text>
          <View style={ns.typePill}>
            <Text style={[ns.typeLabel, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        {/* Point non-lu */}
        {!item.is_read && <View style={ns.unreadDot} />}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Écran principal ───────────────────────────────────────────────────────────
export default function NotificationsScreen() {
  const insets    = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const userId    = (profile as any)?.id ?? null;

  const [notifs,   setNotifs]   = useState<Notification[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const topPad = insets.top || (Platform.OS === 'android' ? 24 : 44);

  // ── Chargement initial ─────────────────────────────────────────────────────
  const fetchNotifs = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (!error && data) setNotifs(data as Notification[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

  // ── Nettoyage automatique des notifications lues créées il y a > 48 h ────
  // On s'appuie sur created_at (la table n'a pas de colonne read_at séparée).
  useEffect(() => {
    if (!userId) return;
    const cutoff = new Date(Date.now() - READ_TTL_MS).toISOString();
    supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId)
      .eq('is_read', true)
      .lt('created_at', cutoff)
      .then(() => {});
  }, [userId]);

  // ── Abonnement temps réel ──────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifs-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setNotifs(prev => [payload.new as Notification, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setNotifs(prev => prev.map(n => n.id === payload.new.id ? payload.new as Notification : n));
          } else if (payload.eventType === 'DELETE') {
            setNotifs(prev => prev.filter(n => n.id !== payload.old.id));
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === notifs.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(notifs.map(n => n.id)));
    }
  };

  const markSelectedRead = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    await supabase.from('notifications').update({ is_read: true }).in('id', ids);
    setNotifs(prev => prev.map(n => ids.includes(n.id) ? { ...n, is_read: true } : n));
    setSelected(new Set());
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    await supabase.from('notifications').delete().in('id', ids);
    setNotifs(prev => prev.filter(n => !ids.includes(n.id)));
    setSelected(new Set());
  };

  const deleteAll = async () => {
    if (!userId) return;
    await supabase.from('notifications').delete().eq('user_id', userId);
    setNotifs([]);
    setSelected(new Set());
  };

  const handlePress = async (item: Notification) => {
    // Marquer comme lu au tap
    if (!item.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', item.id);
      setNotifs(prev => prev.map(n => n.id === item.id ? { ...n, is_read: true } : n));
    }
    // Navigation contextuelle via related_id
    if (item.type === 'order' && item.related_id) {
      router.push({ pathname: '/(client)/order/tracking' as any, params: { id: item.related_id } });
    } else if (item.type === 'booking') {
      router.push('/(client)/history' as any);
    }
  };

  const unreadCount = notifs.filter(n => !n.is_read).length;
  const hasSelection = selected.size > 0;

  return (
    <View style={s.root}>
      {/* ── EN-TÊTE ── */}
      <View style={[s.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.75}>
          <Feather name="arrow-left" size={22} color={DARK} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={s.unreadBadge}>
              <Text style={s.unreadBadgeTxt}>{unreadCount} non lu{unreadCount > 1 ? 'es' : 'e'}</Text>
            </View>
          )}
        </View>
        {notifs.length > 0 && (
          <TouchableOpacity onPress={deleteAll} activeOpacity={0.75}>
            <Text style={s.clearAll}>Tout effacer</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── BARRE D'ACTIONS SÉLECTION ── */}
      {notifs.length > 0 && (
        <View style={s.actionBar}>
          <TouchableOpacity style={s.selectAllBtn} onPress={selectAll} activeOpacity={0.8}>
            <View style={[s.checkSmall, selected.size === notifs.length && s.checkSmallActive]}>
              {selected.size === notifs.length && <Feather name="check" size={10} color={WHITE} />}
            </View>
            <Text style={s.selectAllTxt}>
              {selected.size === notifs.length ? 'Tout désélectionner' : 'Tout sélectionner'}
            </Text>
          </TouchableOpacity>

          {hasSelection && (
            <View style={s.selActions}>
              <TouchableOpacity style={s.selBtn} onPress={markSelectedRead} activeOpacity={0.8}>
                <Feather name="check-circle" size={15} color={DARK} />
                <Text style={s.selBtnTxt}>Lu</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.selBtn, s.selBtnRed]} onPress={deleteSelected} activeOpacity={0.8}>
                <Feather name="trash-2" size={15} color="#EF4444" />
                <Text style={[s.selBtnTxt, { color: '#EF4444' }]}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* ── LISTE ── */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={ORANGE} />
        </View>
      ) : notifs.length === 0 ? (
        <View style={s.center}>
          <View style={s.emptyIcon}>
            <Feather name="bell-off" size={36} color="#D1D5DB" />
          </View>
          <Text style={s.emptyTitle}>Aucune notification</Text>
          <Text style={s.emptySub}>Vous verrez ici vos commandes, réservations, promotions et bien plus.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: (Platform.OS === 'ios' ? insets.bottom : 12) + 20 }}
          showsVerticalScrollIndicator={false}
        >
          {notifs.map(item => (
            <NotifItem
              key={item.id}
              item={item}
              selected={selected.has(item.id)}
              onToggleSelect={toggleSelect}
              onPress={handlePress}
            />
          ))}
          <Text style={s.ttlNote}>
            Les notifications lues sont supprimées automatiquement après 48 heures.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: WHITE },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: H_PAD, paddingBottom: 14, backgroundColor: WHITE, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
  backBtn:      { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#ECECE8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle:  { fontSize: 20, fontWeight: '800', color: DARK },
  unreadBadge:  { backgroundColor: ORANGE, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
  unreadBadgeTxt: { fontSize: 11, fontWeight: '700', color: WHITE },
  clearAll:     { fontSize: 13, fontWeight: '600', color: '#EF4444' },

  actionBar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: H_PAD, paddingVertical: 10, backgroundColor: GRAY_LT, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
  selectAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkSmall:   { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  checkSmallActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  selectAllTxt: { fontSize: 13, fontWeight: '600', color: DARK },
  selActions:   { flexDirection: 'row', gap: 8 },
  selBtn:       { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: WHITE, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#E5E7EB' },
  selBtnRed:    { borderColor: '#FEE2E2', backgroundColor: '#FEF2F2' },
  selBtnTxt:    { fontSize: 12, fontWeight: '600', color: DARK },

  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon:    { width: 80, height: 80, borderRadius: 24, backgroundColor: GRAY_LT, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle:   { fontSize: 18, fontWeight: '800', color: DARK, marginBottom: 8 },
  emptySub:     { fontSize: 14, color: GRAY, lineHeight: 20, textAlign: 'center' },

  ttlNote:      { fontSize: 11, color: '#D1D5DB', textAlign: 'center', marginTop: 20, paddingHorizontal: H_PAD },
});

const ns = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: H_PAD, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F3F4F6' },
  rowUnread:  { backgroundColor: '#FAFAFA' },
  checkWrap:  { paddingRight: 12 },
  check:      { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  checkActive:{ backgroundColor: ORANGE, borderColor: ORANGE },
  body:       { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconBox:    { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  text:       { flex: 1 },
  titleRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  title:      { fontSize: 14, fontWeight: '500', color: DARK, flex: 1, marginRight: 8 },
  titleBold:  { fontWeight: '800' },
  time:       { fontSize: 11, color: GRAY, flexShrink: 0 },
  bodyTxt:    { fontSize: 13, color: GRAY, lineHeight: 18, marginBottom: 6 },
  typePill:   {},
  typeLabel:  { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  unreadDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: ORANGE, flexShrink: 0, marginTop: 4 },
});
