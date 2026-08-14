import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert, Image, Platform, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { useCartStore } from '@/stores/cartStore';
import { signOut, supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, clearAuth } = useAuthStore();
  const clearFavorites = useFavoritesStore((s) => s.clearFavorites);
  const clearCart = useCartStore((s) => s.clearCart);
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    const loadBalance = async () => {
      if (!profile?.id) return;
      const { data } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', profile.id)
        .single();
      if (data) setWalletBalance(data.balance);
    };
    loadBalance();
  }, [profile?.id]);

  const handleSignOut = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnecter', style: 'destructive',
        onPress: async () => {
          try { await signOut(); } catch {}
          clearAuth(); clearFavorites(); clearCart();
          router.replace({ pathname: '/(auth)/phone', params: { mode: 'login' } } as any);
        },
      },
    ]);
  };

  const initials = profile?.name
    ? profile.name.trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const balanceDisplay = walletBalance !== null
    ? `${walletBalance.toLocaleString('fr-FR')} FCFA`
    : '— FCFA';

  const SECTIONS = [
    {
      title: 'Mon compte',
      items: [
        { icon: 'user',   label: 'Informations personnelles', sub: 'Nom, téléphone, email',       route: '/(client)/profile/personal' },
        { icon: 'bell',   label: 'Notifications',             sub: 'Commandes, promos, alertes',  route: '/(client)/profile/notifications' },
        { icon: 'shield', label: 'Sécurité',                  sub: 'NIP, biométrie, suppression', route: '/(client)/profile/security' },
      ],
    },
    {
      title: 'Commerce',
      items: [
        { icon: 'briefcase', label: 'Espace marchand', sub: 'Gérer mon business',    route: '/(pro)/dashboard' },
        { icon: 'heart',     label: 'Mes favoris',          sub: 'Commerces enregistrés', route: '/(client)/favorites' },
      ],
    },
    {
      title: 'Aide',
      items: [
        { icon: 'help-circle', label: 'Aide & Support',           sub: 'FAQ, contact, signalement',         route: '/(client)/profile/help' },
        { icon: 'file-text',   label: "Conditions d'utilisation", sub: 'CGU, politique de confidentialité', route: '/(client)/profile/legal' },
      ],
    },
  ];

  return (
    <View style={[styles.root, { paddingTop: Platform.OS === 'web' ? 67 : insets.top }]}>

      {/* ── Partie fixe ── */}
      <View style={styles.fixedTop}>
        <View style={styles.hero}>

          {/* ── Avatar : photo si disponible, initiales sinon ── */}
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={() => router.push('/(client)/profile/personal' as any)}
            activeOpacity={0.85}
          >
            {profile?.avatar_url ? (
              <Image
                source={{ uri: profile.avatar_url }}
                style={styles.avatarImg}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.initials}>{initials}</Text>
              </View>
            )}
            <View style={styles.avatarEdit}>
              <Feather name="camera" size={10} color="#fff" />
            </View>
          </TouchableOpacity>

          <Text style={styles.name}>{profile?.name ?? 'Utilisateur'}</Text>
          <Text style={styles.phone}>{profile?.phone ?? ''}</Text>

        </View>

        {/* Portefeuille */}
        <TouchableOpacity
          style={styles.walletCard}
          onPress={() => router.push('/(client)/profile/wallet' as any)}
          activeOpacity={0.88}
        >
          <View style={styles.walletLeft}>
            <View style={styles.walletIconWrap}>
              <Feather name="credit-card" size={20} color="#fff" />
            </View>
            <View>
              <Text style={styles.walletLabel}>Portefeuille Bymoh</Text>
              <Text style={styles.walletBalance}>{balanceDisplay}</Text>
            </View>
          </View>
          <View style={styles.walletActions}>
            <View style={styles.walletAction}>
              <Feather name="plus-circle" size={14} color="#fff" />
              <Text style={styles.walletActionText}>Recharger</Text>
            </View>
            <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.6)" />
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Partie défilante ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: botPad + 90 }]}
        showsVerticalScrollIndicator={false}
      >
        {SECTIONS.map((section) => (
          <View key={section.title}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.menuCard}>
              {section.items.map((item, i) => (
                <TouchableOpacity
                  key={item.label}
                  style={[styles.menuItem, i < section.items.length - 1 && styles.menuDivider]}
                  onPress={() => router.push(item.route as any)}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuIconWrap}>
                    <Feather name={item.icon as any} size={18} color="#FF6835" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    <Text style={styles.menuSub}>{item.sub}</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color="#D1D5DB" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <Feather name="log-out" size={18} color="#EF4444" />
          <Text style={styles.signOutText}>Se déconnecter</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Bymoh v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F7F4' },

  fixedTop: {
    paddingHorizontal: 20, paddingTop: 8,
    paddingBottom: 16, gap: 16, backgroundColor: '#F8F7F4',
  },

  hero: { alignItems: 'center', gap: 6, paddingVertical: 12 },

  // Avatar
  avatarWrap: {
    width: 84, height: 84, borderRadius: 42,
    marginBottom: 4, position: 'relative',
  },
  avatarImg: {
    width: 84, height: 84, borderRadius: 42,
  },
  avatarFallback: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: '#FF6835', alignItems: 'center', justifyContent: 'center',
  },
  initials: { fontSize: 30, fontWeight: '800', color: '#fff' },
  avatarEdit: {
    position: 'absolute', bottom: 0, right: 0,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#F8F7F4',
  },

  name: { fontSize: 22, fontWeight: '800', color: '#111827' },
  phone: { fontSize: 14, color: '#9CA3AF' },
  walletCard: {
    backgroundColor: '#1E3A5F', borderRadius: 20, padding: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  walletLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  walletIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  walletLabel: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 3 },
  walletBalance: { fontSize: 20, fontWeight: '800', color: '#fff' },
  walletActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  walletAction: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100,
  },
  walletActionText: { fontSize: 12, fontWeight: '600', color: '#fff' },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 4, gap: 16 },

  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: '#9CA3AF',
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: 6, marginTop: 4,
  },
  menuCard: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  menuDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F3F4F6' },
  menuIconWrap: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: '#FEF2EC', alignItems: 'center', justifyContent: 'center',
  },
  menuLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
  menuSub: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },

  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#FEF2F2', padding: 16, borderRadius: 16,
    borderWidth: 1, borderColor: '#FECACA',
  },
  signOutText: { fontSize: 15, fontWeight: '700', color: '#EF4444' },
  version: { textAlign: 'center', fontSize: 12, color: '#D1D5DB', marginTop: -8 },
});
