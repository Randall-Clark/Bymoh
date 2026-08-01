import { Stack } from 'expo-router';
import React from 'react';

export default function ProLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>

      {/* Dashboard — fade discret */}
      <Stack.Screen
        name="dashboard"
        options={{ animation: 'fade' }}
      />

      {/* Pages standard du pro — fade ou simple pop */}
      <Stack.Screen name="orders"   options={{ animation: 'fade' }} />
      <Stack.Screen name="bookings" options={{ animation: 'fade' }} />
      <Stack.Screen name="hours"    options={{ animation: 'fade' }} />
      <Stack.Screen name="profile"  options={{ animation: 'fade' }} />

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
