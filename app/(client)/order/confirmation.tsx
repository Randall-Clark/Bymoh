import { router } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

export default function OrderConfirmationScreen() {
  const insets = useSafeAreaInsets();
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.root, { paddingBottom: botPad + 24 }]}>
      <View style={styles.content}>
        <View style={styles.icon}>
          <Feather name="check" size={48} color="#fff" />
        </View>
        <Text style={styles.title}>Commande passée !</Text>
        <Text style={styles.subtitle}>
          Votre commande a été transmise au commerce. Vous serez notifié dès qu'elle est confirmée.
        </Text>
        <View style={styles.infoCard}>
          <Feather name="clock" size={16} color="#FF6835" />
          <Text style={styles.infoText}>Délai de livraison estimé : 20–40 min</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(client)/history')}>
          <Text style={styles.primaryText}>Suivre ma commande</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace('/(client)')}>
          <Text style={styles.secondaryText}>Retour à l'accueil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F7F4', paddingHorizontal: 32 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  icon: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#FF6835', alignItems: 'center', justifyContent: 'center', shadowColor: '#FF6835', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 12 },
  title: { fontSize: 28, fontWeight: '800', color: '#111827', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 23 },
  infoCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEF2EC', borderRadius: 14, padding: 14, alignSelf: 'stretch' },
  infoText: { flex: 1, fontSize: 13, color: '#374151', fontWeight: '600' },
  actions: { gap: 12 },
  primaryBtn: { backgroundColor: '#FF6835', padding: 18, borderRadius: 100, alignItems: 'center' },
  primaryText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  secondaryBtn: { padding: 16, borderRadius: 100, alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB' },
  secondaryText: { fontSize: 15, fontWeight: '600', color: '#374151' },
});
