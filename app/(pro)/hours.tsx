// app/(pro)/hours.tsx
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator, Platform, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { HoursSection } from '@/components/pro/HoursSection';

export default function HoursScreen() {
  const insets = useSafeAreaInsets();
  const { businessId } = useLocalSearchParams<{ businessId?: string }>();
  const topPad = (Platform.OS === 'ios' ? insets.top : insets.top) + 8;

  // Charge le business avec ses horaires (même query que pro_business_id)
  const { data: business, isLoading } = useQuery({
    queryKey: ['pro-biz', businessId],
    queryFn: async () => {
      const { data } = await supabase
        .from('businesses')
        .select('*, hours:business_hours(*)')
        .eq('id', businessId!)
        .single();
      return data;
    },
    enabled: !!businessId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F7' }}>
      <View style={[s.header, { paddingTop: topPad }]}>
        <TouchableOpacity style={s.backBtn}
          onPress={() => router.navigate('/(pro)/boutique' as any)}>
          <Feather name="arrow-left" size={20} color="#111827"/>
        </TouchableOpacity>
        <Text style={s.title}>Horaires d'ouverture</Text>
        <View style={{ width: 38 }}/>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#FF6835" style={{ padding: 40 }}/>
      ) : business ? (
        <HoursSection business={business}/>
      ) : (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
          <Text style={{ color:'#9CA3AF' }}>Boutique introuvable</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header:  { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:16, paddingBottom:14, backgroundColor:'#fff', borderBottomWidth:1, borderBottomColor:'#F3F4F6' },
  backBtn: { width:38, height:38, borderRadius:19, backgroundColor:'#F3F4F6', alignItems:'center', justifyContent:'center' },
  title:   { flex:1, fontSize:17, fontWeight:'800', color:'#111827', textAlign:'center' },
});
