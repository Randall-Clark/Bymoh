import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router, Stack, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { OrdersProvider } from "@/context/OrdersContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const PROTECTED_SEGMENTS = ["(tabs)", "business", "booking", "cart", "delivery", "orders", "notifications", "pro"];

function AuthGuard() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;
    const firstSegment = segments[0] as string | undefined;
    const inProtected = firstSegment ? PROTECTED_SEGMENTS.includes(firstSegment) : false;
    if (inProtected && !isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, segments]);

  return null;
}

function RootLayoutNav() {
  return (
    <>
      <AuthGuard />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth/country" />
        <Stack.Screen name="auth/phone" />
        <Stack.Screen name="auth/pin" />
        <Stack.Screen name="auth/otp" />
        <Stack.Screen name="auth/profile" />
        <Stack.Screen name="auth/purpose" />
        <Stack.Screen name="business/[id]" />
        <Stack.Screen name="booking/new" />
        <Stack.Screen name="cart/index" />
        <Stack.Screen name="delivery/choice" />
        <Stack.Screen name="delivery/tracking" />
        <Stack.Screen name="orders/index" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="profile/edit" />
        <Stack.Screen name="pro/register" />
        <Stack.Screen name="pro/dashboard" />
        <Stack.Screen name="pro/catalog" />
        <Stack.Screen name="pro/orders" />
        <Stack.Screen name="pro/schedule" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AuthProvider>
                <CartProvider>
                  <OrdersProvider>
                    <RootLayoutNav />
                  </OrdersProvider>
                </CartProvider>
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
