import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FAQS = [
  { q: 'Comment passer une commande ?', a: 'Sélectionnez un commerce sur la page d\'accueil, choisissez vos articles, ajoutez-les au panier et confirmez votre commande en choisissant un mode de livraison.' },
  { q: 'Comment suivre ma livraison ?', a: 'Une fois la commande confirmée, rendez-vous dans "Mes commandes" pour suivre votre livraison en temps réel via Gozem ou Yango.' },
  { q: 'Comment annuler une commande ?', a: 'Vous pouvez annuler une commande dans les 2 minutes suivant la confirmation. Passé ce délai, contactez le support.' },
  { q: 'Comment enregistrer mon commerce ?', a: 'Allez dans votre profil → Espace professionnel → Créer votre premier commerce. L\'inscription se fait en 5 étapes.' },
  { q: 'Comment recharger mon portefeuille ?', a: 'Dans votre portefeuille, appuyez sur "Recharger" et choisissez un montant. Le paiement se fait via Mobile Money.' },
  { q: 'Mon paiement a échoué, que faire ?', a: 'Vérifiez votre solde Mobile Money et réessayez. Si le problème persiste, contactez notre support via WhatsApp.' },
];

export default function HelpScreen() {
  const insets = useSafeAreaInsets();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <View style={[styles.root, { paddingTop: Platform.OS === 'ios' ? insets.top : insets.top + 8 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Aide & Support</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>

        {/* Contact rapide */}
        <View style={styles.contactRow}>
          {[
            { icon: 'message-circle', label: 'WhatsApp', color: '#22C55E', onPress: () => Linking.openURL('https://wa.me/22900000000') },
            { icon: 'mail', label: 'Email', color: '#FF6835', onPress: () => Linking.openURL('mailto:support@bymoh.com') },
            { icon: 'phone', label: 'Appeler', color: '#1E3A5F', onPress: () => Linking.openURL('tel:+22900000000') },
          ].map((c) => (
            <TouchableOpacity key={c.label} style={styles.contactCard} onPress={c.onPress}>
              <View style={[styles.contactIcon, { backgroundColor: `${c.color}18` }]}>
                <Feather name={c.icon as any} size={22} color={c.color} />
              </View>
              <Text style={styles.contactLabel}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* FAQ */}
        <Text style={styles.sectionLabel}>Questions fréquentes</Text>
        <View style={styles.card}>
          {FAQS.map((faq, i) => (
            <View key={i}>
              <TouchableOpacity
                style={styles.faqRow}
                onPress={() => setOpenFaq(openFaq === i ? null : i)}
                activeOpacity={0.75}
              >
                <Text style={styles.faqQ}>{faq.q}</Text>
                <Feather name={openFaq === i ? 'chevron-up' : 'chevron-down'} size={16} color="#9CA3AF" />
              </TouchableOpacity>
              {openFaq === i && (
                <View style={styles.faqAWrap}>
                  <Text style={styles.faqA}>{faq.a}</Text>
                </View>
              )}
              {i < FAQS.length - 1 && <View style={styles.sep} />}
            </View>
          ))}
        </View>

        {/* Signalement */}
        <View style={styles.reportCard}>
          <Feather name="flag" size={20} color="#F59E0B" />
          <View style={{ flex: 1 }}>
            <Text style={styles.reportLabel}>Signaler un problème</Text>
            <Text style={styles.reportSub}>Commerce, livraison, comportement inapproprié</Text>
          </View>
          <TouchableOpacity style={styles.reportBtn}>
            <Text style={styles.reportBtnText}>Signaler</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F7F4' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  content: { padding: 20, gap: 20 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },

  contactRow: { flexDirection: 'row', gap: 12 },
  contactCard: { flex: 1, alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 16, paddingVertical: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  contactIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  contactLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },

  card: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  faqRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  faqQ: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827', lineHeight: 20 },
  faqAWrap: { paddingHorizontal: 16, paddingBottom: 16 },
  faqA: { fontSize: 14, color: '#6B7280', lineHeight: 21 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: '#F3F4F6', marginHorizontal: 16 },

  reportCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#FFFBEB', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#FDE68A' },
  reportLabel: { fontSize: 15, fontWeight: '700', color: '#92400E' },
  reportSub: { fontSize: 12, color: '#B45309', marginTop: 2 },
  reportBtn: { backgroundColor: '#F59E0B', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  reportBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
