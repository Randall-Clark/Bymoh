import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Platform, ScrollView,
  StyleSheet, Switch, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────
interface NotifPrefs {
  orders: boolean;
  promos: boolean;
  bookings: boolean;
  news: boolean;
  security: boolean;
}

const DEFAULT_PREFS: NotifPrefs = {
  orders: true,
  promos: true,
  bookings: true,
  news: false,
  security: true,
};

const NOTIF_ITEMS: { id: keyof NotifPrefs; label: string; sub: string; locked?: boolean }[] = [
  { id: 'orders',   label: 'Commandes',       sub: 'Statut, confirmation, livraison' },
  { id: 'promos',   label: 'Promotions',       sub: 'Offres et réductions du moment' },
  { id: 'bookings', label: 'Réservations',     sub: 'Rappels et confirmations' },
  { id: 'news',     label: 'Nouveautés Bymoh', sub: 'Nouveaux commerces, services' },
  { id: 'security', label: 'Sécurité',         sub: 'Connexions, alertes de compte', locked: true },
];

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();

  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<keyof NotifPrefs | 'push' | null>(null);

  // ── Charger les préférences depuis Supabase ────────────────────────────────
  useEffect(() => {
    const load = async () => {
      if (!profile?.id) return;
      try {
        const { data, error } = await supabase
          .from('users')
          .select('notification_prefs')
          .eq('id', profile.id)
          .single();

        if (error) throw error;

        if (data?.notification_prefs) {
          // Fusionner avec les défauts pour gérer les nouvelles clés
          setPrefs({ ...DEFAULT_PREFS, ...data.notification_prefs });
        }
      } catch {
        // Colonne absente ou autre erreur → on garde les défauts
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [profile?.id]);

  // ── Sauvegarder une préférence dès qu'elle change ─────────────────────────
  const togglePref = async (key: keyof NotifPrefs) => {
    if (key === 'security') return; // Sécurité toujours activée

    const newPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(newPrefs);
    setSaving(key);

    try {
      await supabase
        .from('users')
        .update({ notification_prefs: newPrefs })
        .eq('id', profile?.id ?? '');
    } catch {
      // Rollback si échec
      setPrefs(prefs);
    } finally {
      setSaving(null);
    }
  };

  const togglePush = (value: boolean) => {
    setPushEnabled(value);
    setSaving('push');
    // Ici on pourrait sauvegarder push_enabled dans users aussi
    setTimeout(() => setSaving(null), 500);
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#FF6835" />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: Platform.OS === 'ios' ? insets.top : insets.top + 8 }]}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Toggle push global ── */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.iconWrap}>
              <Feather name="bell" size={18} color="#FF6835" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Notifications push</Text>
              <Text style={styles.rowSub}>Activer / désactiver toutes les notifications</Text>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={togglePush}
              trackColor={{ false: '#E5E7EB', true: '#FF6835' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* ── Catégories ── */}
        <Text style={styles.sectionLabel}>Catégories</Text>
        <View style={styles.card}>
          {NOTIF_ITEMS.map((item, i) => {
            const isLocked = item.locked;
            const value = isLocked ? true : (prefs[item.id] && pushEnabled);
            const isSaving = saving === item.id;

            return (
              <View key={item.id}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.labelRow}>
                      <Text style={[styles.rowLabel, !pushEnabled && !isLocked && { color: '#9CA3AF' }]}>
                        {item.label}
                      </Text>
                      {isLocked && (
                        <View style={styles.lockedBadge}>
                          <Feather name="lock" size={10} color="#9CA3AF" />
                          <Text style={styles.lockedText}>Toujours actif</Text>
                        </View>
                      )}
                      {isSaving && <ActivityIndicator size="small" color="#FF6835" style={{ marginLeft: 8 }} />}
                    </View>
                    <Text style={styles.rowSub}>{item.sub}</Text>
                  </View>
                  <Switch
                    value={value}
                    onValueChange={() => togglePref(item.id)}
                    disabled={!pushEnabled || isLocked}
                    trackColor={{ false: '#E5E7EB', true: '#FF6835' }}
                    thumbColor="#fff"
                  />
                </View>
                {i < NOTIF_ITEMS.length - 1 && <View style={styles.sep} />}
              </View>
            );
          })}
        </View>

        {/* ── Note informative ── */}
        <View style={styles.infoBox}>
          <Feather name="info" size={14} color="#1E3A5F" />
          <Text style={styles.infoText}>
            Les notifications de sécurité sont toujours activées pour protéger votre compte.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F7F4' },
  centered: { alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  content: { padding: 20, gap: 16 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },

  card: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  iconWrap: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#FEF2EC', alignItems: 'center', justifyContent: 'center' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
  rowSub: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: '#F3F4F6' },

  lockedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 100 },
  lockedText: { fontSize: 10, color: '#9CA3AF', fontWeight: '600' },

  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#EEF2FF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#C7D2FE' },
  infoText: { flex: 1, fontSize: 13, color: '#1E3A5F', lineHeight: 18 },
});
