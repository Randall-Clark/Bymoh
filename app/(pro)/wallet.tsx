// app/(pro)/wallet.tsx
// Onglet Finances — affiche directement le portefeuille de la boutique active
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useMyBusinesses } from '@/hooks/useBusinesses';
import BusinessWalletScreen from './business/wallet';

export default function WalletTab() {
  const { profile } = useAuthStore();
  const [activeBizId, setActiveBizId] = useState<string | null>(null);
  const { data: businesses = [], isLoading } = useMyBusinesses(profile?.id ?? '');
  const bizId = activeBizId ?? (businesses[0] as any)?.id ?? null;

  if (isLoading) {
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', backgroundColor:'#F2F2F7' }}>
        <ActivityIndicator color="#FF6835" size="large"/>
      </View>
    );
  }

  if (!bizId) return null;

  return <BusinessWalletScreen overrideBizId={bizId} onChangeBiz={setActiveBizId} businesses={businesses}/>;
}
