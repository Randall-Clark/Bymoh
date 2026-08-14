// app/(client)/profile/legal.tsx
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Platform, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Tab = 'cgu' | 'privacy';

export default function LegalScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('cgu');
  const topPad = Platform.OS === 'web' ? 67 : insets.top + 12;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mentions légales</Text>
      </View>

      {/* Onglets */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'cgu' && styles.tabActive]}
          onPress={() => setTab('cgu')}
        >
          <Text style={[styles.tabText, tab === 'cgu' && styles.tabTextActive]}>
            Conditions d'utilisation
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'privacy' && styles.tabActive]}
          onPress={() => setTab('privacy')}
        >
          <Text style={[styles.tabText, tab === 'privacy' && styles.tabTextActive]}>
            Confidentialité
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {tab === 'cgu' ? (
          <View style={styles.content}>
            <Text style={styles.lastUpdate}>Dernière mise à jour : Août 2026</Text>

            <Section title="1. Acceptation des conditions">
              En accédant à Bymoh et en l'utilisant, vous acceptez d'être lié par les présentes Conditions Générales d'Utilisation. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser notre service.
            </Section>

            <Section title="2. Description du service">
              Bymoh est une plateforme de mise en relation entre clients et commerces locaux au Bénin, Côte d'Ivoire, Sénégal et Togo. Nous facilitons la découverte, la commande et la livraison de produits et services.
            </Section>

            <Section title="3. Inscription et compte">
              Pour utiliser Bymoh, vous devez créer un compte avec un numéro de téléphone valide. Vous êtes responsable de la confidentialité de votre NIP et de toutes les activités effectuées depuis votre compte.
            </Section>

            <Section title="4. Responsabilités des marchands">
              Les marchands sont seuls responsables de l'exactitude des informations de leurs boutiques, de la qualité de leurs produits et services, et du respect des lois locales applicables.
            </Section>

            <Section title="5. Paiements et frais">
              Bymoh peut percevoir des frais de service sur les transactions. Ces frais sont clairement indiqués avant toute confirmation de commande. Les prix affichés incluent toutes les taxes applicables.
            </Section>

            <Section title="6. Livraison">
              Les délais et frais de livraison varient selon votre localisation et celle du commerce. Des frais supplémentaires peuvent s'appliquer si votre adresse de livraison ne correspond pas à votre pays de résidence.
            </Section>

            <Section title="7. Modifications">
              Bymoh se réserve le droit de modifier ces conditions à tout moment. Les utilisateurs seront notifiés par l'application en cas de changements importants.
            </Section>

            <Section title="8. Contact">
              Pour toute question relative aux présentes conditions, contactez-nous à l'adresse : support@bymoh.app
            </Section>
          </View>
        ) : (
          <View style={styles.content}>
            <Text style={styles.lastUpdate}>Dernière mise à jour : Août 2026</Text>

            <Section title="1. Données collectées">
              Nous collectons les informations suivantes :{'\n'}
              • Numéro de téléphone (identification){'\n'}
              • Nom et adresse email (optionnel){'\n'}
              • Adresse de résidence et de livraison{'\n'}
              • Pays de résidence et fuseau horaire{'\n'}
              • Historique des commandes et réservations
            </Section>

            <Section title="2. Utilisation des données">
              Vos données sont utilisées pour :{'\n'}
              • Gérer votre compte et vos commandes{'\n'}
              • Personnaliser votre expérience (boutiques proches){'\n'}
              • Vous envoyer des notifications de commandes{'\n'}
              • Améliorer nos services
            </Section>

            <Section title="3. Partage des données">
              Nous ne vendons jamais vos données personnelles. Elles peuvent être partagées avec :{'\n'}
              • Les marchands pour traiter vos commandes{'\n'}
              • Les livreurs pour effectuer les livraisons{'\n'}
              • Nos prestataires techniques (Supabase, Vonage)
            </Section>

            <Section title="4. Sécurité">
              Vos données sont stockées de manière sécurisée. Votre NIP est hashé et ne peut être récupéré. Nous utilisons des connexions chiffrées (HTTPS/TLS) pour toutes les communications.
            </Section>

            <Section title="5. Vos droits">
              Vous pouvez à tout moment :{'\n'}
              • Accéder à vos données personnelles{'\n'}
              • Modifier vos informations depuis le profil{'\n'}
              • Supprimer votre compte et toutes vos données{'\n'}
              • Demander une copie de vos données à support@bymoh.app
            </Section>

            <Section title="6. Cookies et tracking">
              Bymoh n'utilise pas de cookies publicitaires. Nous utilisons uniquement des données analytiques anonymisées pour améliorer l'application.
            </Section>

            <Section title="7. Contact DPO">
              Pour toute question relative à la protection de vos données, contactez notre responsable : privacy@bymoh.app
            </Section>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#F8F7F4' },
  header:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn:       { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle:   { fontSize: 18, fontWeight: '800', color: '#111827' },
  tabs:          { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  tab:           { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:     { borderBottomColor: '#FF6835' },
  tabText:       { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  tabTextActive: { color: '#FF6835' },
  scroll:        { padding: 20, gap: 4 },
  content:       { gap: 20 },
  lastUpdate:    { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },
  section:       { gap: 8 },
  sectionTitle:  { fontSize: 15, fontWeight: '800', color: '#111827' },
  sectionText:   { fontSize: 14, color: '#374151', lineHeight: 22 },
});
