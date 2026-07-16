import { Stack } from 'expo-router';
import React from 'react';

export default function ProLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="orders" />
      <Stack.Screen name="bookings" />
      <Stack.Screen name="hours" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="register/step1" />
      <Stack.Screen name="register/step2" />
      <Stack.Screen name="register/step3" />
      <Stack.Screen name="register/step4" />
      <Stack.Screen name="register/payment" />
      <Stack.Screen name="catalog/index" />
      <Stack.Screen name="catalog/edit" />
    </Stack>
  );
}
