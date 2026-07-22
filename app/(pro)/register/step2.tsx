import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import React, { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';
import { Feather } from '@expo/vector-icons';
import { StepIndicator } from '@/components/forms/StepIndicator';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ALL_CITIES } from '@/types';
import { registerDraft } from './step1';

// ── Indicatifs téléphoniques ──────────────────────────────────────────────────
const DIAL_CODES = [
  { code: '+229', flag: '🇧🇯', name: 'Bénin' },
  { code: '+228', flag: '🇹🇬', name: 'Togo' },
  { code: '+225', flag: '🇨🇮', name: 'Côte d\'Ivoire' },
  { code: '+221', flag: '🇸🇳', name: 'Sénégal' },
  { code: '+233', flag: '🇬🇭', name: 'Ghana' },
  { code: '+237', flag: '🇨🇲', name: 'Cameroun' },
  { code: '+223', flag: '🇲🇱', name: 'Mali' },
  { code: '+226', flag: '🇧🇫', name: 'Burkina Faso' },
  { code: '+227', flag: '🇳🇪', name: 'Niger' },
];

const MAX_LOCAL_DIGITS = 10;

// ── Schéma ────────────────────────────────────────────────────────────────────
const schema = z.object({
  phone: z
    .string()
    .min(6, 'Numéro trop court')
    .max(MAX_LOCAL_DIGITS, `Max ${MAX_LOCAL_DIGITS} chiffres`)
    .regex(/^\d+$/, 'Chiffres uniquement'),
  address: z.string().min(5, 'Adresse requise'),
  city: z.string().min(1, 'Ville requise'),
});
type FormData = z.infer<typeof schema>;

export default function RegisterStep2() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [dialCode, setDialCode] = useState(DIAL_CODES[0]);
  const [dialModalVisible, setDialModalVisible] = useState(false);
  const [coverUri, setCoverUri] = useState<string | null>(null);

  const { control, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { phone: '', address: '', city: '' },
  });
  const selectedCity = watch('city');

  // ── Scroll automatique vers le champ actif ────────────────────────────────
  const scrollToY = (y: number) => {
    scrollRef.current?.scrollTo({ y: y - 100, animated: true });
  };

  // ── Photo de couverture ───────────────────────────────────────────────────
  const pickCover = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setCoverUri(result.assets[0].uri);
    }
  };

  // ── Soumission ─────────────────────────────────────────────────────────────
  const onSubmit = (data: FormData) => {
    Object.assign(registerDraft, {
      phone: `${dialCode.code}${data.phone}`,
      address: data.address,
      city: data.city,
      cover_uri: coverUri ?? null,
    });
    router.push('/(pro)/register/step3' as any);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {/* Header fixe — ne défile pas */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <StepIndicator current={2} total={5} title="Localisation & Contact" />

        {/* ── Ville : FlatList horizontal fixe dans sa zone ────────────────── */}
        <View style={styles.section}>
          <Text style={styles.label}>Ville *</Text>
          {/* nestedScrollEnabled évite que le scroll horizontal remonte la page */}
          <FlatList
            horizontal
            data={[...ALL_CITIES]}
            keyExtractor={(c) => c.id}
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
            renderItem={({ item }) => {
              const active = selectedCity === item.name;
              return (
                <TouchableOpacity
                  style={[styles.cityChip, active && styles.cityChipActive]}
                  onPress={() => setValue('city', item.name)}
                >
                  <Text style={styles.flag}>{item.flag}</Text>
                  <Text style={[styles.cityName, active && { color: '#FF6835' }]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
          {errors.city && <Text style={styles.error}>{errors.city.message}</Text>}
        </View>

        {/* ── Adresse ──────────────────────────────────────────────────────── */}
        <View
          onLayout={(e) => {
            // Mémorise la position Y pour le scroll auto au focus
          }}
        >
          <Controller
            control={control}
            name="address"
            render={({ field: { onChange, value, onBlur } }) => (
              <Input
                label="Adresse complète *"
                placeholder="Rue, quartier, numéro..."
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.address?.message}
                leftIcon="map-pin"
                onFocus={() => scrollToY(180)}
              />
            )}
          />
        </View>

        {/* ── Téléphone ─────────────────────────────────────────────────────── */}
        <View
          style={styles.section}
          onLayout={(e) => {
            const y = e.nativeEvent.layout.y;
            // stocke la position pour le scroll au focus
          }}
        >
          <Text style={styles.label}>Téléphone du commerce *</Text>
          <View style={styles.phoneRow}>

            {/* Bouton indicatif → ouvre le Modal */}
            <TouchableOpacity
              style={styles.dialBtn}
              onPress={() => {
                setDialModalVisible(true);
                scrollToY(300);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.dialFlag}>{dialCode.flag}</Text>
              <Text style={styles.dialCode}>{dialCode.code}</Text>
              <Feather name="chevron-down" size={13} color="#6B7280" />
            </TouchableOpacity>

            {/* Input numéro */}
            <View style={styles.phoneInput}>
              <Controller
                control={control}
                name="phone"
                render={({ field: { onChange, value, onBlur } }) => (
                  <Input
                    placeholder="XX XX XX XX"
                    value={value}
                    onChangeText={(text) => {
                      const digits = text.replace(/\D/g, '').slice(0, MAX_LOCAL_DIGITS);
                      onChange(digits);
                    }}
                    onBlur={onBlur}
                    onFocus={() => scrollToY(320)}
                    keyboardType="number-pad"
                    maxLength={MAX_LOCAL_DIGITS}
                    error={errors.phone?.message}
                  />
                )}
              />
            </View>
          </View>
        </View>

        {/* ── Photo de couverture ───────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.label}>Photo de couverture</Text>
          <Text style={styles.hint}>Format 16/9 recommandé — visible sur la fiche de votre commerce</Text>

          <TouchableOpacity
            style={styles.coverPicker}
            onPress={pickCover}
            activeOpacity={0.85}
          >
            {coverUri ? (
              <>
                <Image source={{ uri: coverUri }} style={styles.coverPreview} />
                <View style={styles.coverOverlay}>
                  <Feather name="edit-2" size={18} color="#fff" />
                  <Text style={styles.coverOverlayText}>Changer la photo</Text>
                </View>
              </>
            ) : (
              <View style={styles.coverPlaceholder}>
                <Feather name="image" size={32} color="#9CA3AF" />
                <Text style={styles.coverPlaceholderText}>Appuyez pour ajouter une photo</Text>
                <Text style={styles.coverPlaceholderSub}>JPG ou PNG — max 5 Mo</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Footer fixe */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button title="Suivant →" onPress={handleSubmit(onSubmit)} fullWidth size="lg" />
      </View>

      {/* ── Modal indicatif téléphonique ─────────────────────────────────────
          Overlay flottant — ne déplace PAS la page principale              */}
      <Modal
        visible={dialModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDialModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setDialModalVisible(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.modalBox}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Choisir l'indicatif</Text>
                  <TouchableOpacity onPress={() => setDialModalVisible(false)}>
                    <Feather name="x" size={20} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                {DIAL_CODES.map((dc) => (
                  <TouchableOpacity
                    key={dc.code}
                    style={[
                      styles.dialItem,
                      dc.code === dialCode.code && styles.dialItemActive,
                    ]}
                    onPress={() => {
                      setDialCode(dc);
                      setDialModalVisible(false);
                    }}
                  >
                    <Text style={styles.dialItemFlag}>{dc.flag}</Text>
                    <Text style={[
                      styles.dialItemName,
                      dc.code === dialCode.code && { color: '#FF6835' },
                    ]}>
                      {dc.name}
                    </Text>
                    <Text style={styles.dialItemCode}>{dc.code}</Text>
                    {dc.code === dialCode.code && (
                      <Feather name="check" size={16} color="#FF6835" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F8F7F4' },
  header: { paddingHorizontal: 20, paddingBottom: 8, backgroundColor: '#F8F7F4' },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 24 },

  section: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  hint: { fontSize: 12, color: '#9CA3AF', marginTop: -4 },
  error: { fontSize: 12, color: '#EF4444' },

  // Ville
  cityChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, borderWidth: 1.5,
    borderColor: '#E5E7EB', backgroundColor: '#fff',
  },
  cityChipActive: { borderColor: '#FF6835', backgroundColor: '#FEF2EC' },
  flag: { fontSize: 18 },
  cityName: { fontSize: 13, fontWeight: '600', color: '#6B7280' },

  // Téléphone
  phoneRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dialBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14,
    paddingHorizontal: 10, paddingVertical: 15, backgroundColor: '#fff',
  },
  dialFlag: { fontSize: 18 },
  dialCode: { fontSize: 13, fontWeight: '600', color: '#111827' },
  phoneInput: { flex: 1 },

  // Photo couverture
  coverPicker: {
    height: 180, borderRadius: 16,
    borderWidth: 1.5, borderColor: '#E5E7EB', borderStyle: 'dashed',
    overflow: 'hidden', backgroundColor: '#fff',
  },
  coverPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  coverOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, paddingVertical: 10,
  },
  coverOverlayText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  coverPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  coverPlaceholderText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  coverPlaceholderSub: { fontSize: 12, color: '#9CA3AF' },

  // Footer
  footer: {
    backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 10,
  },

  // Modal indicatif
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalBox: {
    backgroundColor: '#fff', borderRadius: 20,
    padding: 8, width: '100%', maxWidth: 360,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 24, elevation: 16,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    marginBottom: 4,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  dialItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12,
  },
  dialItemActive: { backgroundColor: '#FEF2EC' },
  dialItemFlag: { fontSize: 22 },
  dialItemName: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' },
  dialItemCode: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
});
