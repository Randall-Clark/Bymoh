// app/(pro)/bookings/[id].tsx
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

const ORANGE = '#FF6835';
const DARK   = '#111827';

// ── Types de statut ───────────────────────────────────────────────────────────
const STATUS_INFO: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  pending:   { label: 'En attente',  color: '#F59E0B', bg: '#FEF3C7', dot: '#F59E0B' },
  confirmed: { label: 'Confirmée',   color: '#3B82F6', bg: '#EFF6FF', dot: '#3B82F6' },
  completed: { label: 'Terminée',    color: '#22C55E', bg: '#F0FDF4', dot: '#22C55E' },
  cancelled: { label: 'Annulée',     color: '#9CA3AF', bg: '#F3F4F6', dot: '#9CA3AF' },
};

// Actions disponibles selon le statut actuel
const STATUS_ACTIONS: Record<string, { label: string; next: string; color: string; icon: string }[]> = {
  pending:   [
    { label: 'Confirmer',  next: 'confirmed', color: '#3B82F6', icon: 'check-circle' },
    { label: 'Annuler',    next: 'cancelled', color: '#EF4444', icon: 'x-circle'     },
  ],
  confirmed: [
    { label: 'Marquer terminée', next: 'completed', color: '#22C55E', icon: 'check-circle' },
    { label: 'Annuler',          next: 'cancelled', color: '#EF4444', icon: 'x-circle'     },
  ],
  completed: [],
  cancelled: [],
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}
function fmtDateTime(d: string) {
  const date = new Date(d);
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
    + ' · '
    + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  '#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#DDA0DD','#85C1E9',
];
function getAvatarColor(name: string) {
  const idx = name.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

// ─────────────────────────────────────────────────────────────────────────────
export default function BookingDetailScreen() {
  const insets   = useSafeAreaInsets();
  const { id }   = useLocalSearchParams<{ id: string }>();
  const qc       = useQueryClient();
  const [updating, setUpdating] = useState(false);
  const topPad = (Platform.OS === 'ios' ? insets.top : insets.top) + 12;

  const { data: booking, isLoading } = useQuery({
    queryKey: ['pro-booking-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          user:users(id, name, phone),
          service:services(id, title, description, price, pricing_type),
          business:businesses(id, name)
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // ── Changer le statut ─────────────────────────────────────────────────────
  const updateStatus = async (nextStatus: string) => {
    if (!booking) return;
    const label = STATUS_INFO[nextStatus]?.label ?? nextStatus;
    Alert.alert(
      'Confirmation',
      `Passer cette réservation à "${label}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          style: nextStatus === 'cancelled' ? 'destructive' : 'default',
          onPress: async () => {
            setUpdating(true);
            try {
              const { error } = await supabase
                .from('bookings')
                .update({ status: nextStatus, updated_at: new Date().toISOString() })
                .eq('id', booking.id);
              if (error) throw error;
              // Invalider les caches
              qc.invalidateQueries({ queryKey: ['pro-booking-detail', id] });
              qc.invalidateQueries({ queryKey: ['pro-bookings'] });
            } catch (err: any) {
              Alert.alert('Erreur', err.message ?? 'Impossible de mettre à jour.');
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

  // ── Chargement ────────────────────────────────────────────────────────────
  if (isLoading || !booking) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F2F7' }}>
        <ActivityIndicator color={ORANGE} size="large" />
      </View>
    );
  }

  const st        = STATUS_INFO[booking.status] ?? STATUS_INFO['pending'];
  const actions   = STATUS_ACTIONS[booking.status] ?? [];
  const clientName = booking.user?.name ?? 'Client';
  const initials  = getInitials(clientName);
  const avatarBg  = getAvatarColor(clientName);
  const shortId   = booking.id.slice(-6).toUpperCase();

  // Date/heure du créneau
  const slotDate = booking.booking_date
    ? fmtDate(booking.booking_date)
    : booking.date
      ? fmtDate(booking.date)
      : null;
  const slotTime = booking.start_time
    ? booking.start_time.slice(0, 5)
    : booking.time
      ? booking.time.slice(0, 5)
      : null;

  const totalAmount = Number(booking.total_amount ?? booking.subtotal ?? 0);
  const subtotal    = Number(booking.subtotal ?? 0);
  const discount    = subtotal > 0 && totalAmount < subtotal ? subtotal - totalAmount : 0;

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F7' }}>

      {/* ══ Header ═══════════════════════════════════════════════════════════ */}
      <View style={[s.hero, { paddingTop: topPad }]}>
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
            <Feather name="arrow-left" size={20} color="#fff" />
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={s.headerLabel}>Réservation</Text>
            <Text style={s.headerId}>#{shortId}</Text>
          </View>

          {/* Placeholder pour équilibrer */}
          <View style={s.backBtn} />
        </View>

        {/* Badge statut */}
        <View style={s.statusWrap}>
          <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
            <View style={[s.statusDot, { backgroundColor: st.dot }]} />
            <Text style={[s.statusTxt, { color: st.color }]}>{st.label}</Text>
          </View>
          <Text style={s.createdAt}>Créée le {fmtDateTime(booking.created_at)}</Text>
        </View>
      </View>

      {/* ══ Contenu ══════════════════════════════════════════════════════════ */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 100 }}
      >

        {/* ── Client ── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Client</Text>
          <View style={s.clientRow}>
            <View style={[s.avatar, { backgroundColor: avatarBg }]}>
              <Text style={s.avatarTxt}>{initials}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.clientName}>{clientName}</Text>
              {booking.user?.phone && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Feather name="phone" size={12} color="#9CA3AF" />
                  <Text style={s.clientSub}>{booking.user.phone}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ── Créneau ── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Créneau</Text>
          <View style={s.infoGrid}>
            {slotDate && (
              <View style={s.infoItem}>
                <Feather name="calendar" size={15} color={ORANGE} />
                <View>
                  <Text style={s.infoLabel}>Date</Text>
                  <Text style={s.infoValue}>{slotDate}</Text>
                </View>
              </View>
            )}
            {slotTime && (
              <View style={s.infoItem}>
                <Feather name="clock" size={15} color={ORANGE} />
                <View>
                  <Text style={s.infoLabel}>Heure</Text>
                  <Text style={s.infoValue}>{slotTime}</Text>
                </View>
              </View>
            )}
            {booking.party_size && (
              <View style={s.infoItem}>
                <Feather name="users" size={15} color={ORANGE} />
                <View>
                  <Text style={s.infoLabel}>Personnes</Text>
                  <Text style={s.infoValue}>{booking.party_size}</Text>
                </View>
              </View>
            )}
            {booking.quantity && booking.quantity > 1 && (
              <View style={s.infoItem}>
                <Feather name="hash" size={15} color={ORANGE} />
                <View>
                  <Text style={s.infoLabel}>Quantité</Text>
                  <Text style={s.infoValue}>{booking.quantity}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* ── Service ── */}
        {booking.service && (
          <View style={s.card}>
            <Text style={s.sectionTitle}>Service</Text>
            <View style={s.infoItem}>
              <View style={s.serviceIcon}>
                <Feather name="tag" size={14} color={ORANGE} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.clientName}>{booking.service.title}</Text>
                {booking.service.description && (
                  <Text style={s.clientSub} numberOfLines={2}>{booking.service.description}</Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* ── Paiement ── */}
        {totalAmount > 0 && (
          <View style={s.card}>
            <Text style={s.sectionTitle}>Paiement</Text>
            <View style={s.recapRows}>
              {subtotal > 0 && subtotal !== totalAmount && (
                <View style={s.recapRow}>
                  <Text style={s.recapLabel}>Sous-total</Text>
                  <Text style={s.recapVal}>{subtotal.toLocaleString('fr-FR')} FCFA</Text>
                </View>
              )}
              {discount > 0 && (
                <View style={s.recapRow}>
                  <Text style={[s.recapLabel, { color: '#22C55E' }]}>Réduction</Text>
                  <Text style={[s.recapVal, { color: '#22C55E' }]}>-{discount.toLocaleString('fr-FR')} FCFA</Text>
                </View>
              )}
              <View style={[s.recapRow, s.recapTotal]}>
                <Text style={s.recapTotalLabel}>Total</Text>
                <Text style={s.recapTotalVal}>{totalAmount.toLocaleString('fr-FR')} FCFA</Text>
              </View>
            </View>
            {booking.payment_method && (
              <View style={s.payMethodRow}>
                <Feather name="credit-card" size={13} color="#9CA3AF" />
                <Text style={s.payMethodTxt}>
                  {booking.payment_method === 'cash'  ? 'Espèces'       :
                   booking.payment_method === 'momo'  ? 'Mobile Money'  :
                   booking.payment_method === 'card'  ? 'Carte bancaire' :
                   booking.payment_method}
                </Text>
                {booking.payment_status && (
                  <View style={[
                    s.payStatusBadge,
                    { backgroundColor: booking.payment_status === 'paid' ? '#F0FDF4' : '#FEF3C7' }
                  ]}>
                    <Text style={[
                      s.payStatusTxt,
                      { color: booking.payment_status === 'paid' ? '#22C55E' : '#F59E0B' }
                    ]}>
                      {booking.payment_status === 'paid' ? 'Payé' : 'En attente'}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* ── Notes ── */}
        {booking.notes && (
          <View style={s.card}>
            <Text style={s.sectionTitle}>Notes du client</Text>
            <View style={s.noteBox}>
              <Feather name="message-square" size={14} color="#9CA3AF" />
              <Text style={s.noteTxt}>{booking.notes}</Text>
            </View>
          </View>
        )}

        {/* ── Actions statut ── */}
        {actions.length > 0 && (
          <View style={s.actionsCard}>
            <Text style={s.sectionTitle}>Actions</Text>
            <View style={s.actionsRow}>
              {actions.map((action) => (
                <TouchableOpacity
                  key={action.next}
                  style={[s.actionBtn, { backgroundColor: action.color }, updating && { opacity: 0.6 }]}
                  onPress={() => updateStatus(action.next)}
                  disabled={updating}
                  activeOpacity={0.85}
                >
                  {updating ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Feather name={action.icon as any} size={16} color="#fff" />
                      <Text style={s.actionTxt}>{action.label}</Text>
                    </>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Statut terminal */}
        {actions.length === 0 && (
          <View style={s.terminalWrap}>
            <Feather
              name={booking.status === 'completed' ? 'check-circle' : 'x-circle'}
              size={20}
              color={booking.status === 'completed' ? '#22C55E' : '#9CA3AF'}
            />
            <Text style={[s.terminalTxt, { color: booking.status === 'completed' ? '#22C55E' : '#9CA3AF' }]}>
              {booking.status === 'completed'
                ? 'Réservation terminée'
                : 'Réservation annulée'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  // ── Header ────────────────────────────────────────────────────────────────
  hero: {
    backgroundColor: DARK,
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerLabel: {
    fontSize: 12, fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  headerId: {
    fontSize: 22, fontWeight: '900', color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  statusWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusTxt: { fontSize: 13, fontWeight: '700' },
  createdAt: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },

  // ── Cards ─────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: '#fff', borderRadius: 18, padding: 18, gap: 14,
    borderWidth: 1, borderColor: '#F0F0F0',
  },
  sectionTitle: {
    fontSize: 11, fontWeight: '800', color: '#9CA3AF',
    textTransform: 'uppercase', letterSpacing: 0.8,
  },

  // ── Client ────────────────────────────────────────────────────────────────
  clientRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt:  { fontSize: 16, fontWeight: '800', color: '#fff' },
  clientName: { fontSize: 16, fontWeight: '700', color: DARK },
  clientSub:  { fontSize: 13, color: '#9CA3AF' },

  // ── Créneau / infos ───────────────────────────────────────────────────────
  infoGrid: { gap: 12 },
  infoItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
  },
  infoLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  infoValue: { fontSize: 15, fontWeight: '700', color: DARK, marginTop: 1 },

  // ── Service ───────────────────────────────────────────────────────────────
  serviceIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#FEF2EC',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Paiement ──────────────────────────────────────────────────────────────
  recapRows: { gap: 8 },
  recapRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recapLabel: { fontSize: 14, color: '#6B7280' },
  recapVal:   { fontSize: 14, fontWeight: '600', color: DARK },
  recapTotal: {
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
    paddingTop: 10, marginTop: 2,
  },
  recapTotalLabel: { fontSize: 16, fontWeight: '800', color: DARK },
  recapTotalVal:   { fontSize: 18, fontWeight: '900', color: ORANGE },
  payMethodRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12,
  },
  payMethodTxt:   { fontSize: 13, fontWeight: '600', color: '#6B7280', flex: 1 },
  payStatusBadge: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
  payStatusTxt:   { fontSize: 11, fontWeight: '700' },

  // ── Notes ─────────────────────────────────────────────────────────────────
  noteBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12,
  },
  noteTxt: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 20 },

  // ── Actions ───────────────────────────────────────────────────────────────
  actionsCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 18, gap: 14,
    borderWidth: 1, borderColor: '#F0F0F0',
  },
  actionsRow: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 14, paddingVertical: 14,
  },
  actionTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // ── Statut terminal ───────────────────────────────────────────────────────
  terminalWrap: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 16,
  },
  terminalTxt: { fontSize: 14, fontWeight: '600' },
});
