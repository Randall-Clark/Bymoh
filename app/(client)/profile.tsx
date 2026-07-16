import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { useCartStore } from '@/stores/cartStore';
import { signOut } from '@/lib/supabase';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, clearAuth } = useAuthStore();
  const clearFavorites = useFavoritesStore((s) => s.clearFavorites);
  const clearCart = useCartStore((s) => s.clearCart);
  const topPad = Platform.OS === 'web' ? 67 : insets.top + 8;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const handleSignOut = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnecter',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch {
            // Si Supabase échoue (token expiré, réseau…), on nettoie quand même
          }
          clearAuth();
          clearFavorites();
          clearCart();
          router.replace('/');
        },
      },
    ]);
  };

  const initials = profile?.name
    ? profile.name.trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const MENU_ITEMS = [
    { icon: 'user', label: 'Informations personnelles', onPress: () => {} },
    { icon: 'bell', label: 'Notifications', onPress: () => {} },
    { icon: 'shield', label: 'Sécurité', onPress: () => {} },
    { icon: 'briefcase', label: 'Espace professionnel', onPress: () => router.push('/(pro)/dashboard' as any) },
    { icon: 'help-circle', label: 'Aide & Support', onPress: () => {} },
    { icon: 'file-text', label: 'Conditions d\'utilisation', onPress: () => {} },
  ] as const;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: botPad + 80 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Avatar + info */}
      <View style={styles.profileSection}>
        <View style={styles.avatar}>
          <Text style={styles.initials}>{initials}</Text>
        </View>
        <Text style={styles.name}>
          {profile?.name ?? 'Utilisateur'}
        </Text>
        <Text style={styles.role}>
          {profile?.role === 'pro' ? '🏪 Professionnel' : '🛍️ Client'}
        </Text>
      </View>

      {/* Menu */}
      <View style={styles.menuCard}>
        {MENU_ITEMS.map((item, i) => (
          <TouchableOpacity
            key={item.label}
            style={[styles.menuItem, i < MENU_ITEMS.length - 1 && styles.menuDivider]}
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            <View style={styles.menuIconWrap}>
              <Feather name={item.icon} size={18} color="#FF6835" />
            </View>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Feather name="chevron-right" size={16} color="#D1D5DB" />
          </TouchableOpacity>
        ))}
      </View>

      {/* Sign out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
        <Feather name="log-out" size={18} color="#EF4444" />
        <Text style={styles.signOutText}>Se déconnecter</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Bymoh v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F7F4' },
  content: { paddingHorizontal: 20, gap: 20 },
  profileSection: { alignItems: 'center', gap: 8, paddingVertical: 16 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#FF6835', alignItems: 'center', justifyContent: 'center',
  },
  initials: { fontSize: 28, fontWeight: '800', color: '#fff' },
  name: { fontSize: 22, fontWeight: '800', color: '#111827' },
  role: { fontSize: 14, color: '#6B7280' },
  menuCard: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  menuDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F3F4F6' },
  menuIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FEF2EC', alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#FEF2F2', padding: 16, borderRadius: 16,
    borderWidth: 1, borderColor: '#FECACA',
  },
  signOutText: { fontSize: 15, fontWeight: '700', color: '#EF4444' },
  version: { textAlign: 'center', fontSize: 12, color: '#D1D5DB' },
});
