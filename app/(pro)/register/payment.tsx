import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { StepIndicator } from '@/components/forms/StepIndicator';
import { Button } from '@/components/ui/Button';
import { registerDraft } from './step1';

const PLANS = [
  { id: 'free', label: 'Gratuit', price: 0, features: ['1 commerce', 'Jusqu\'à 10 articles', 'Support email'], popular: false },
  { id: 'pro', label: 'Pro', price: 9900, features: ['Commerces illimités', 'Articles illimités', 'Livraison Gozem/Yango', 'Analytics avancées', 'Support prioritaire'], popular: true },
  { id: 'business', label: 'Business', price: 24900, features: ['Tout dans Pro', 'Page dédiée', 'Publicité ciblée', 'Manager dédié'], popular: false },
];

export default function RegisterPaymentScreen() {
  const insets = useSafeAreaInsets();
  const { session, setProfile } = useAuthStore();
  const [selectedPlan, setSelectedPlan] = useState('free');
  const [loading, setLoading] = useState(false);

  const complete = async () => {
    if (!session?.user?.id) { Alert.alert('Non connecté'); return; }
    setLoading(true);
    try {
      const biz = {
        owner_id: session.user.id,
        name: (registerDraft as any).name,
        category: (registerDraft as any).category,
        phone: (registerDraft as any).phone,
        address: (registerDraft as any).address,
        city: (registerDraft as any).city,
        description: (registerDraft as any).description ?? '',
        email: (registerDraft as any).email ?? '',
        has_delivery: (registerDraft as any).has_delivery ?? false,
        is_active: true,
        is_open: false,
        is_verified: false,
        forfait_paid: false,
        open_hour: '09:00',
        close_hour: '18:00',
        rating: 0,
        review_count: 0,
        booking_mode: 'none',
      };
      const { data: newBiz, error } = await supabase.from('businesses').insert(biz).select().single();
      if (error) throw error;

      // Insert hours if provided
      const schedule = (registerDraft as any).schedule;
      if (schedule && newBiz) {
        const hours = schedule.map((h: any, i: number) => ({ business_id: newBiz.id, day_of_week: i, ...h }));
        await supabase.from('business_hours').insert(hours);
      }

      // Update profile role to pro
      const { error: profileError } = await supabase.from('users').update({ role: 'pro' }).eq('id', session.user.id);
      if (!profileError) {
        const { data: p } = await supabase.from('users').select('*').eq('id', session.user.id).single();
        if (p) setProfile(p as any);
      }

      router.replace('/(pro)/dashboard' as any);
    } catch (err: unknown) {
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}>
        <StepIndicator current={5} total={5} title="Choisir votre offre" />

        {PLANS.map((plan) => (
          <TouchableOpacity key={plan.id} style={[styles.planCard, selectedPlan === plan.id && styles.planCardActive, plan.popular && styles.planCardPopular]} onPress={() => setSelectedPlan(plan.id)} activeOpacity={0.88}>
            {plan.popular && <View style={styles.popularBadge}><Text style={styles.popularText}>⭐ Populaire</Text></View>}
            <View style={styles.planTop}>
              <Text style={[styles.planName, selectedPlan === plan.id && { color: '#FF6835' }]}>{plan.label}</Text>
              <View>
                <Text style={[styles.planPrice, selectedPlan === plan.id && { color: '#FF6835' }]}>
                  {plan.price === 0 ? 'Gratuit' : `${plan.price.toLocaleString('fr-FR')} FCFA`}
                </Text>
                {plan.price > 0 && <Text style={styles.planPeriod}>/mois</Text>}
              </View>
            </View>
            {plan.features.map((f) => (
              <View key={f} style={styles.featureRow}>
                <Feather name="check" size={14} color={selectedPlan === plan.id ? '#FF6835' : '#22C55E'} />
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
            {selectedPlan === plan.id && (
              <View style={styles.selectedMark}>
                <Feather name="check-circle" size={20} color="#FF6835" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button title={loading ? 'Création en cours…' : 'Créer mon commerce 🎉'} onPress={complete} loading={loading} fullWidth size="lg" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F7F4' },
  flex: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },
  planCard: { backgroundColor: '#fff', borderRadius: 18, padding: 18, gap: 10, borderWidth: 1.5, borderColor: '#E5E7EB', position: 'relative', overflow: 'hidden' },
  planCardActive: { borderColor: '#FF6835', backgroundColor: '#FEF2EC' },
  planCardPopular: { borderColor: '#FF6835' },
  popularBadge: { position: 'absolute', top: 0, right: 0, backgroundColor: '#FF6835', paddingHorizontal: 12, paddingVertical: 4, borderBottomLeftRadius: 14 },
  popularText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  planTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 4 },
  planName: { fontSize: 20, fontWeight: '800', color: '#111827' },
  planPrice: { fontSize: 18, fontWeight: '800', color: '#111827', textAlign: 'right' },
  planPeriod: { fontSize: 11, color: '#9CA3AF', textAlign: 'right' },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 13, color: '#374151' },
  selectedMark: { position: 'absolute', bottom: 12, right: 12 },
  footer: { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 16, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 10 },
});
