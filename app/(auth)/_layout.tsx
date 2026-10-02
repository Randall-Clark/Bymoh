// app/(auth)/_layout.tsx
import { Stack } from 'expo-router';
import React from 'react';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="phone"         options={{ headerShown: false }} />
      <Stack.Screen name="otp"           options={{ headerShown: false }} />
      <Stack.Screen name="pin-login"     options={{ headerShown: false }} />
      <Stack.Screen name="signup"        options={{ headerShown: false }} />
      <Stack.Screen name="forgot-pin"    options={{ headerShown: false }} />
      <Stack.Screen name="setup-address" options={{ headerShown: false }} />
    </Stack>
  );
}
