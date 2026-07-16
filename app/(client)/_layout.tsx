import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Platform, StyleSheet, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PRIMARY = '#FF6835';
const MUTED = '#9CA3AF';

function TabIcon({ name, color }: { name: React.ComponentProps<typeof Feather>['name']; color: string }) {
  return <Feather name={name} size={22} color={color} />;
}

export default function ClientLayout() {
  const isDark = useColorScheme() === 'dark';
  const isIOS = Platform.OS === 'ios';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: PRIMARY,
        tabBarInactiveTintColor: MUTED,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : '#fff',
          borderTopWidth: isIOS ? 0 : StyleSheet.hairlineWidth,
          borderTopColor: '#E5E7EB',
          elevation: 0,
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
      <Tabs.Screen
        name="index"
        options={{ title: 'Accueil', tabBarIcon: ({ color }) => <TabIcon name="home" color={color} /> }}
      />
      <Tabs.Screen
        name="search"
        options={{ title: 'Recherche', tabBarIcon: ({ color }) => <TabIcon name="search" color={color} /> }}
      />
      <Tabs.Screen
        name="favorites"
        options={{ title: 'Favoris', tabBarIcon: ({ color }) => <TabIcon name="heart" color={color} /> }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: 'Commandes', tabBarIcon: ({ color }) => <TabIcon name="clock" color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profil', tabBarIcon: ({ color }) => <TabIcon name="user" color={color} /> }}
      />
      {/* Non-tab screens */}
      <Tabs.Screen name="business/[id]" options={{ href: null }} />
      <Tabs.Screen name="booking/[businessId]" options={{ href: null }} />
      <Tabs.Screen name="booking/confirmation" options={{ href: null }} />
      <Tabs.Screen name="order/cart" options={{ href: null }} />
      <Tabs.Screen name="order/delivery" options={{ href: null }} />
      <Tabs.Screen name="order/tracking" options={{ href: null }} />
      <Tabs.Screen name="order/confirmation" options={{ href: null }} />
    </Tabs>
  );
}
