// app/(pro)/merchant-welcome.tsx
//
// Page plein écran affichée quand le marchand n'a aucune boutique enregistrée.
// Elle se positionne EN DEHORS du contenu tabulé : la tab bar est masquée
// via navigation.getParent().setOptions() et restaurée au démontage.
//
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Image, Linking, Platform, Pressable,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ORANGE = '#FF6835';
const DARK   = '#1A1025';

export default function MerchantWelcomeScreen() {
  const insets     = useSafeAreaInsets();
  const [accepted, setAccepted] = useState(false);

  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Cercles décoratifs */}
      <View style={s.circleLg} />
      <View style={s.circleSm} />

      {/* Bouton retour → espace client */}
      <TouchableOpacity
        style={[s.backBtn, { top: insets.top + 8 }]}
        onPress={() => router.push('/(client)/profile' as any)}
        activeOpacity={0.75}
      >
        <Feather name="arrow-left" size={20} color="rgba(255,255,255,0.75)" />
      </TouchableOpacity>

      {/* Contenu centré fixe — pas de scroll */}
      <View style={s.content}>

        {/* Logo */}
        <View style={s.logoWrap}>
          <Image
            source={require('@/assets/images/merchantlogo.png')}
            style={s.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={s.title}>Bienvenue sur{'\n'}l'espace marchand</Text>
        <Text style={s.sub}>
          Créez votre vitrine en 2 minutes et faites décoller votre activité.
        </Text>

        {/* Points forts */}
        <View style={s.featureList}>
          {[
            { icon: 'trending-up', text: 'Suivez vos ventes en temps réel' },
            { icon: 'users',       text: 'Touchez de nouveaux clients' },
            { icon: 'calendar',    text: 'Simplifiez vos commandes et réservations en un clic' },
          ].map((f, i) => (
            <View key={i} style={s.featureRow}>
              <View style={s.featureIcon}>
                <Feather name={f.icon as any} size={16} color={ORANGE} />
              </View>
              <Text style={s.featureTxt}>{f.text}</Text>
            </View>
          ))}
        </View>

        {/* Case à cocher CGU + politique de données */}
        <Pressable style={s.termsRow} onPress={() => setAccepted(v => !v)}>
          <View style={[s.checkbox, accepted && s.checkboxOn]}>
            {accepted && <Feather name="check" size={11} color="#fff" />}
          </View>
          <Text style={s.termsTxt}>
            J'ai lu et j'accepte les{' '}
            <Text
              style={s.termsLink}
              onPress={(e) => {
                e.stopPropagation();
                Linking.openURL('https://bymoh.app/cgu-marchand');
              }}
            >
              conditions d'utilisation
            </Text>
            {' '}et la{' '}
            <Text
              style={s.termsLink}
              onPress={(e) => {
                e.stopPropagation();
                Linking.openURL('https://bymoh.app/politique-donnees');
              }}
            >
              politique de données
            </Text>
            {' '}liées au compte marchand.
          </Text>
        </Pressable>

        {/* CTA */}
        <TouchableOpacity
          style={[s.cta, !accepted && s.ctaDisabled]}
          onPress={accepted ? () => router.push('/(pro)/register/step1' as any) : undefined}
          activeOpacity={accepted ? 0.88 : 1}
          disabled={!accepted}
        >
          <Text style={[s.ctaTxt, !accepted && s.ctaTxtDisabled]}>
            Enregistrer mon activité
          </Text>
        </TouchableOpacity>

      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: DARK, overflow: 'hidden' },
  circleLg:       { position: 'absolute', width: 380, height: 380, borderRadius: 190, borderWidth: 50, borderColor: 'rgba(255,104,53,0.08)', right: -120, top: -60 },
  circleSm:       { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 35, borderColor: 'rgba(255,104,53,0.06)', left: -60, bottom: 120 },
  backBtn:        { position: 'absolute', left: 16, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  content:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  logoWrap:       { width: 120, height: 80, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  logo:           { width: 120, height: 80 },
  title:          { fontSize: 32, fontWeight: '900', color: '#fff', textAlign: 'center', lineHeight: 40, marginBottom: 14 },
  sub:            { fontSize: 15, color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 22, marginBottom: 36 },
  featureList:    { width: '100%', gap: 14, marginBottom: 36 },
  featureRow:     { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIcon:    { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,104,53,0.15)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  featureTxt:     { fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: '500', flex: 1 },
  termsRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12, width: '100%', marginBottom: 20, padding: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  checkbox:       { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: 'rgba(255,255,255,0.30)', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  checkboxOn:     { backgroundColor: ORANGE, borderColor: ORANGE },
  termsTxt:       { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 19 },
  termsLink:      { color: ORANGE, fontWeight: '600', textDecorationLine: 'underline' },
  cta:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: ORANGE, borderRadius: 18, paddingVertical: 18, paddingHorizontal: 32, width: '100%' },
  ctaDisabled:    { backgroundColor: 'rgba(255,255,255,0.12)' },
  ctaTxt:         { fontSize: 16, fontWeight: '800', color: '#fff' },
  ctaTxtDisabled: { color: '#6B7280' },
});
