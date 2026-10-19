import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { Platform, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useCartStore } from '@/stores/cartStore';

const PRIMARY = '#FF6835';
const MUTED   = '#9CA3AF';

// Hauteur de la tab bar — à utiliser dans tous les écrans pour positionner les boutons
export const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 83 : 60;

function TabIcon({ name, color }: { name: React.ComponentProps<typeof Feather>['name']; color: string }) {
  return <Feather name={name} size={22} color={color} />;
}

// Icône panier avec badge dynamique
function CartTabIcon({ color }: { color: string }) {
  const cartStore = useCartStore() as any;
  const total     = (cartStore.items ?? []).reduce((a: number, i: any) => a + (i.quantity ?? 0), 0);
  return (
    <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="cart-outline" size={24} color={color} />
      {total > 0 && (
        <View style={badge.dot}>
          <Text style={badge.txt}>{total > 99 ? '99+' : total}</Text>
        </View>
      )}
    </View>
  );
}

export default function ClientLayout() {
  const isDark = useColorScheme() === 'dark';
  const isIOS  = Platform.OS === 'ios';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:   PRIMARY,
        tabBarInactiveTintColor: MUTED,
        tabBarStyle: {
          position:        'absolute',
          backgroundColor: isIOS ? 'transparent' : '#fff',
          borderTopWidth:  isIOS ? 0 : StyleSheet.hairlineWidth,
          borderTopColor:  '#E5E7EB',
          elevation:       0,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={95} tint={isDark ? 'dark' : 'extraLight'} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#fff' }]} />
          ),
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
      }}
    >
      <Tabs.Screen name="index"       options={{ title: 'Accueil',   tabBarIcon: ({ color }) => <TabIcon name="home"  color={color as string} /> }} />
      <Tabs.Screen name="search"      options={{ href: null }} />
      <Tabs.Screen name="order/carts" options={{ title: 'Panier',    tabBarIcon: ({ color }) => <CartTabIcon color={color as string} /> }} />
      <Tabs.Screen name="history"     options={{ title: 'Commandes', tabBarIcon: ({ color }) => <MaterialCommunityIcons name="invoice-text-outline" size={22} color={color as string} /> }} />
      <Tabs.Screen name="profile"     options={{ title: 'Profil',    tabBarIcon: ({ color }) => <TabIcon name="user"  color={color as string} /> }} />

      {/* Écrans cachés de la tab bar — accessibles via router.push */}
      <Tabs.Screen name="cart"                       options={{ href: null }} />
      <Tabs.Screen name="favorites"                  options={{ href: null }} />
      <Tabs.Screen name="notifications"              options={{ href: null }} />
      <Tabs.Screen name="business/[id]"              options={{ href: null }} />
      <Tabs.Screen name="service/[id]"               options={{ href: null }} />
      <Tabs.Screen name="article/[id]"               options={{ href: null }} />
      <Tabs.Screen name="order/cart"                 options={{ href: null }} />
      <Tabs.Screen name="order/checkout"             options={{ href: null }} />
      <Tabs.Screen name="order/delivery"             options={{ href: null }} />
      <Tabs.Screen name="order/confirmation"         options={{ href: null }} />
      <Tabs.Screen name="order/tracking"             options={{ href: null }} />
      <Tabs.Screen name="booking/[businessId]"       options={{ href: null }} />
      <Tabs.Screen name="booking/confirmation"       options={{ href: null }} />
    </Tabs>
  );
}

const badge = StyleSheet.create({
  dot: {
    position: 'absolute', top: -4, right: -6,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: '#fff',
  },
  txt: { fontSize: 9, fontWeight: '800', color: '#fff' },
});
