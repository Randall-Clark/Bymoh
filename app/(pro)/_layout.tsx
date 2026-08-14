import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import React from 'react';

export default function ProLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>

      {/* Dashboard — fade discret */}
      <Stack.Screen name="dashboard" options={{
        headerShown: true,
        headerTitle: '',
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.push('/(client)' as any)}>
            <Feather name="arrow-left" size={22} color="#111827" />
          </TouchableOpacity>
        ),
      }} />

      {/* Pages standard du pro — fade ou simple pop */}
      <Stack.Screen name="orders"   options={{ animation: 'fade' }} />
      <Stack.Screen name="bookings" options={{ animation: 'fade' }} />
      <Stack.Screen name="hours"    options={{ animation: 'fade' }} />
      <Stack.Screen name="profile"  options={{ animation: 'fade' }} />
      <Stack.Screen name="business/[id]" options={{ animation: 'slide_from_right' }} />

      {/* ── Flow création de commerce ──────────────────────────────────────── */}

      {/* Step 1 — transition simple pour l'entrée dans le flow */}
      <Stack.Screen
        name="register/step1"
        options={{ animation: 'fade' }}
      />

      {/* Steps suivants — fade pour avancer/reculer */}
      <Stack.Screen name="register/step2"   options={{ animation: 'fade' }} />
      <Stack.Screen name="register/step3"   options={{ animation: 'fade' }} />
      <Stack.Screen name="register/step4"   options={{ animation: 'fade' }} />
      <Stack.Screen name="register/payment" options={{ animation: 'fade' }} />

      {/* Catalogue */}
      <Stack.Screen name="catalog/index" options={{ animation: 'fade' }} />
      <Stack.Screen name="catalog/edit"  options={{ animation: 'fade' }} />
    </Stack>
  );
}
