import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const STEPS = [
  { id: 'confirmed', label: 'Commande confirmée', icon: 'check-circle', done: true },
  { id: 'preparing', label: 'En préparation', icon: 'package', done: true },
  { id: 'delivering', label: 'En cours de livraison', icon: 'truck', done: false, active: true },
  { id: 'delivered', label: 'Livré', icon: 'home', done: false },
];

export default function TrackingScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top + 8;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.root, { paddingTop: topPad, paddingBottom: botPad + 24 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Suivi de commande</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Map placeholder */}
        <View style={styles.mapPlaceholder}>
          <Feather name="map" size={48} color="#D1D5DB" />
          <Text style={styles.mapText}>Carte de suivi</Text>
        </View>

        {/* ETA */}
        <View style={styles.eta}>
          <Text style={styles.etaTime}>~15 min</Text>
          <Text style={styles.etaLabel}>Temps de livraison estimé</Text>
        </View>

        {/* Progress steps */}
        <View style={styles.steps}>
          {STEPS.map((step, i) => (
            <View key={step.id} style={styles.stepRow}>
              <View style={styles.stepLeft}>
                <View style={[
                  styles.stepCircle,
                  step.done && styles.stepCircleDone,
                  (step as any).active && styles.stepCircleActive,
                ]}>
                  <Feather name={step.icon as any}
                    size={16}
                    color={step.done || (step as any).active ? '#fff' : '#D1D5DB'}
                  />
                </View>
                {i < STEPS.length - 1 && (
                  <View style={[styles.stepLine, step.done && styles.stepLineDone]} />
                )}
              </View>
              <View style={styles.stepInfo}>
                <Text style={[
                  styles.stepLabel,
                  step.done && styles.stepLabelDone,
                  (step as any).active && styles.stepLabelActive,
                ]}>{step.label}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F7F4' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 16 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: '#111827' },
  content: { paddingHorizontal: 20, gap: 20, paddingBottom: 20 },
  mapPlaceholder: { height: 200, backgroundColor: '#E5E7EB', borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 8 },
  mapText: { fontSize: 14, color: '#9CA3AF' },
  eta: { backgroundColor: '#FF6835', borderRadius: 20, padding: 20, alignItems: 'center', gap: 4 },
  etaTime: { fontSize: 36, fontWeight: '800', color: '#fff' },
  etaLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  steps: { backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 0 },
  stepRow: { flexDirection: 'row', gap: 14 },
  stepLeft: { alignItems: 'center', width: 36 },
  stepCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  stepCircleDone: { backgroundColor: '#22C55E' },
  stepCircleActive: { backgroundColor: '#FF6835' },
  stepLine: { width: 2, flex: 1, backgroundColor: '#F3F4F6', marginVertical: 4 },
  stepLineDone: { backgroundColor: '#22C55E' },
  stepInfo: { flex: 1, paddingVertical: 8 },
  stepLabel: { fontSize: 14, color: '#9CA3AF', fontWeight: '500' },
  stepLabelDone: { color: '#22C55E', fontWeight: '700' },
  stepLabelActive: { color: '#FF6835', fontWeight: '700' },
});
