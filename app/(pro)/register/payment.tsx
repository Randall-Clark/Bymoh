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

// ── Offres disponibles ────────────────────────────────────────────────────────
const PLANS = [
  {
    id: 'annual',
    label: 'Forfait Annuel',
    price: 35000,
    period: '/an',
    badge: null,
    features: [
      'Fiche commerce complète',
      'Catalogue de services illimité',
      'Réservations & commandes',
      'Livraison Gozem / Yango',
      'Support prioritaire',
      'Visibilité auprès de tous les clients',
    ],
    isTest: false,
  },
  {
    id: 'test',
    label: 'Mode Test',
    price: 0,
    period: null,
    badge: '🧪 Développement uniquement',
    features: [
      'Toutes les fonctionnalités actives',
      'Aucun paiement requis',
      'À retirer avant la mise en production',
    ],
    isTest: true,
  },
];

export default function RegisterPaymentScreen() {
  const insets = useSafeAreaInsets();
  const { profile, setProfile } = useAuthStore();
  const [selectedPlan, setSelectedPlan] = useState('annual');
  const [loading, setLoading] = useState(false);

  const complete = async () => {
    if (!profile?.id) { Alert.alert('Non connecté'); return; }

    const plan = PLANS.find((p) => p.id === selectedPlan);
    const isTestMode = plan?.isTest ?? false;

    // Si forfait payant → simuler la redirection paiement
    // (à remplacer par Stripe / Mobile Money quand prêt)
    if (!isTestMode) {
      Alert.alert(
        'Paiement',
        `Le paiement de ${plan?.price.toLocaleString('fr-FR')} FCFA sera intégré prochainement.\n\nPour l'instant, utilisez le mode Test pour continuer.`,
        [{ text: 'OK' }],
      );
      return;
    }

    setLoading(true);
    try {
      const draft = registerDraft as any;

      const biz = {
        owner_id: profile.id,
        name: draft.name,
        category: draft.category,
        phone: draft.phone,
        address: draft.address,
        city: draft.city,
        description: draft.description ?? '',
        email: draft.email ?? '',
        has_delivery: draft.has_delivery ?? false,
        cover_url: draft.cover_uri ?? null,
        is_active: true,
        is_open: false,
        is_verified: false,
        forfait_paid: false,   // false en mode test
        open_hour: '09:00',
        close_hour: '18:00',
        rating: 0,
        review_count: 0,
        booking_mode: 'none',
      };

      const { data: newBiz, error } = await supabase
        .from('businesses')
        .insert(biz)
        .select()
        .single();
      if (error) throw error;

      // Horaires si renseignés
      const schedule = draft.schedule;
      if (schedule && newBiz) {
        const hours = schedule.map((h: any, i: number) => ({
          business_id: newBiz.id,
          day_of_week: i,
          ...h,
        }));
        await supabase.from('business_hours').insert(hours);
      }

      // Passer le profil en "pro"
      await supabase.from('users').update({ role: 'pro' }).eq('id', profile.id);
      const { data: updatedProfile } = await supabase
        .from('users').select('*').eq('id', profile.id).single();
      if (updatedProfile) setProfile(updatedProfile as any);

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

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
      >
        <StepIndicator current={5} total={5} title="Choisir votre offre" />

        {PLANS.map((plan) => {
          const active = selectedPlan === plan.id;
          return (
            <TouchableOpacity
              key={plan.id}
              style={[
                styles.planCard,
                active && styles.planCardActive,
                plan.isTest && styles.planCardTest,
              ]}
              onPress={() => setSelectedPlan(plan.id)}
              activeOpacity={0.88}
            >
              {/* Badge */}
              {plan.badge && (
                <View style={styles.testBadge}>
                  <Text style={styles.testBadgeText}>{plan.badge}</Text>
                </View>
              )}

              {!plan.isTest && (
                <View style={styles.recommendedBadge}>
                  <Text style={styles.recommendedText}>⭐ Offre unique</Text>
                </View>
              )}

              <View style={styles.planTop}>
                <Text style={[styles.planName, active && { color: plan.isTest ? '#6B7280' : '#FF6835' }]}>
                  {plan.label}
                </Text>
                <View>
                  <Text style={[styles.planPrice, active && { color: plan.isTest ? '#6B7280' : '#FF6835' }]}>
                    {plan.price === 0 ? 'Gratuit' : `${plan.price.toLocaleString('fr-FR')} FCFA`}
                  </Text>
                  {plan.period && (
                    <Text style={styles.planPeriod}>{plan.period}</Text>
                  )}
                </View>
              </View>

              {plan.features.map((f) => (
                <View key={f} style={styles.featureRow}>
                  <Feather
                    name="check"
                    size={14}
                    color={plan.isTest ? '#9CA3AF' : (active ? '#FF6835' : '#22C55E')}
                  />
                  <Text style={[styles.featureText, plan.isTest && { color: '#9CA3AF' }]}>
                    {f}
                  </Text>
                </View>
              ))}

              {active && (
                <View style={styles.selectedMark}>
                  <Feather name="check-circle" size={20} color={plan.isTest ? '#9CA3AF' : '#FF6835'} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {selectedPlan === 'test' ? (
          <Button
            title={loading ? 'Création en cours…' : '🧪 Continuer en mode test'}
            onPress={complete}
            loading={loading}
            fullWidth
            size="lg"
            style={styles.testBtn}
          />
        ) : (
          <Button
            title={loading ? 'Création en cours…' : 'Procéder au paiement →'}
            onPress={complete}
            loading={loading}
            fullWidth
            size="lg"
          />
        )}
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

  // Cartes offres
  planCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 18,
    gap: 10, borderWidth: 1.5, borderColor: '#E5E7EB',
    position: 'relative', overflow: 'hidden',
  },
  planCardActive: { borderColor: '#FF6835', backgroundColor: '#FEF2EC' },
  planCardTest: { borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', opacity: 0.9 },

  recommendedBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: '#FF6835',
    paddingHorizontal: 12, paddingVertical: 4,
    borderBottomLeftRadius: 14,
  },
  recommendedText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  testBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, marginBottom: 4,
  },
  testBadgeText: { fontSize: 11, fontWeight: '600', color: '#6B7280' },

  planTop: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginTop: 4,
  },
  planName: { fontSize: 20, fontWeight: '800', color: '#111827' },
  planPrice: { fontSize: 18, fontWeight: '800', color: '#111827', textAlign: 'right' },
  planPeriod: { fontSize: 11, color: '#9CA3AF', textAlign: 'right' },

  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 13, color: '#374151' },
  selectedMark: { position: 'absolute', bottom: 12, right: 12 },

  // Footer
  footer: {
    backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 10,
  },
  testBtn: { backgroundColor: '#6B7280' },
});
