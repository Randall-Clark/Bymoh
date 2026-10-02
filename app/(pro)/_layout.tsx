// app/(pro)/_layout.tsx
import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ORANGE = '#FF6835';
const MUTED  = '#9CA3AF';

function TabIcon({
  name, label, focused,
}: {
  name: React.ComponentProps<typeof Feather>['name'];
  label: string;
  focused: boolean;
}) {
  return (
    <View style={s.tabItem}>
      {focused && <View style={s.indicator}/>}
      <Feather name={name} size={22} color={focused ? ORANGE : MUTED}/>
      <Text style={[s.tabLabel, focused && s.tabLabelActive]}>{label}</Text>
    </View>
  );
}

export default function ProLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom > 0 ? insets.bottom : 16;
  const tabBarHeight = 58 + bottomInset;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: tabBarHeight,
          paddingBottom: bottomInset,
          paddingTop: 6,
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#F0F0F0',
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        },
        tabBarShowLabel: false,
      }}>

      <Tabs.Screen
        name="dashboard"
        options={{
          tabBarIcon: ({ focused }) =>
            <TabIcon name="home" label="Accueil" focused={focused}/>,
        }}/>

      <Tabs.Screen
        name="orders"
        options={{
          tabBarIcon: ({ focused }) =>
            <TabIcon name="shopping-bag" label="Commandes" focused={focused}/>,
        }}/>

      <Tabs.Screen
        name="wallet"
        options={{
          tabBarIcon: ({ focused }) =>
            <TabIcon name="credit-card" label="Finances" focused={focused}/>,
        }}/>

      <Tabs.Screen
        name="boutique"
        options={{
          tabBarIcon: ({ focused }) =>
            <TabIcon name="shopping-bag" label="Boutique" focused={focused}/>,
        }}/>

      {/* ── Écrans cachés de la tab bar ── */}
      <Tabs.Screen name="orders/[id]"   options={{ href: null }}/>
      <Tabs.Screen name="notifications"  options={{ href: null }}/>
      <Tabs.Screen name="bookings"         options={{ href: null }}/>
      <Tabs.Screen name="hours"            options={{ href: null }}/>
      <Tabs.Screen name="profile"          options={{ href: null }}/>
      <Tabs.Screen name="business/[id]"    options={{ href: null }}/>
      <Tabs.Screen name="business/settings" options={{ href: null }}/>
      <Tabs.Screen name="business/wallet"  options={{ href: null }}/>
      <Tabs.Screen name="catalog/edit"     options={{ href: null }}/>
      <Tabs.Screen name="catalog/index"    options={{ href: null }}/>
      <Tabs.Screen name="register/payment" options={{ href: null }}/>
      <Tabs.Screen name="register/step1"   options={{ href: null }}/>
      <Tabs.Screen name="register/step2"   options={{ href: null }}/>
      <Tabs.Screen name="register/step3"   options={{ href: null }}/>
      <Tabs.Screen name="register/step4"   options={{ href: null }}/>

    </Tabs>
  );
}

const s = StyleSheet.create({
  tabItem:       { alignItems:'center', justifyContent:'center', gap:2, paddingTop:4, width:70 },
  tabLabel:      { fontSize:10, fontWeight:'600', color:MUTED },
  tabLabelActive:{ color:ORANGE },
  indicator:     { position:'absolute', top:-6, width:24, height:3, borderRadius:2, backgroundColor:ORANGE },
});
