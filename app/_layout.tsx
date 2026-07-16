import '../global.css';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router, Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';

SplashScreen.preventAutoHideAsync();
const queryClient = new QueryClient();

const PROTECTED = ['(client)', '(pro)'];

function AuthGuard() {
  const { session, profile, isLoading } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;
    const first = segments[0] as string | undefined;
    const inProtected = first ? PROTECTED.includes(first) : false;
    const inAuth = first === '(auth)';

    if (!session && inProtected) {
      // Not logged in — send to landing
      router.replace('/');
    } else if (session && !profile && !inAuth) {
      // Logged in but no profile yet → complete profile
      router.replace('/(auth)/complete-profile');
    } else if (session && profile && !profile.pin_hash && !inAuth) {
      // Profile exists but PIN not configured yet → set PIN
      router.replace('/(auth)/set-pin');
    } else if (session && profile && profile.pin_hash && (first === undefined || inAuth)) {
      // Fully set up → go to app
      router.replace('/(client)');
    }
  }, [session, profile, isLoading, segments]);

  return null;
}

function RootLayoutNav() {
  return (
    <>
      <AuthGuard />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(client)" />
        <Stack.Screen name="(pro)" />
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
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <RootLayoutNav />
        </GestureHandlerRootView>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
