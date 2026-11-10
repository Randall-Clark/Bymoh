// components/DeliveryZoneSetupModal.tsx
//
// Usage in catalog/edit.tsx (already integrated):
//   import { useDeliveryZoneGuard } from '@/components/DeliveryZoneSetupModal';
//   const { checkZones, DeliveryZoneModal } = useDeliveryZoneGuard(businessId ?? '');
//   // Call checkZones() when delivery_only or both is selected
//   // Render {DeliveryZoneModal} anywhere in JSX

import { Feather } from '@expo/vector-icons';
import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '@/lib/supabase';

const ORANGE = '#FF6835';

interface Zone {
  id: string;
  label: string;
  price: string;
}

interface DeliveryZoneSetupModalProps {
  visible: boolean;
  businessId: string;
  onDone: () => void;
  onDismiss: () => void;
}

export function DeliveryZoneSetupModal({
  visible,
  businessId,
  onDone,
  onDismiss,
}: DeliveryZoneSetupModalProps) {
  const [zones, setZones] = useState<Zone[]>([{ id: uid(), label: '', price: '' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ── Animation scale + fade ──────────────────────────────────────────────────
  const scale   = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const animateIn = () => {
    scale.setValue(0.85);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale,   { toValue: 1,   useNativeDriver: true, tension: 65, friction: 8 }),
      Animated.timing(opacity, { toValue: 1,   useNativeDriver: true, duration: 220 }),
    ]).start();
  };

  const animateOut = (cb: () => void) => {
    Animated.parallel([
      Animated.spring(scale,   { toValue: 0.85, useNativeDriver: true, tension: 65, friction: 8 }),
      Animated.timing(opacity, { toValue: 0,    useNativeDriver: true, duration: 160 }),
    ]).start(cb);
  };

  // Run animateIn each time modal becomes visible
  React.useEffect(() => {
    if (visible) {
      setZones([{ id: uid(), label: '', price: '' }]);
      setError('');
      animateIn();
    }
  }, [visible]);

  // ── Helpers zones ───────────────────────────────────────────────────────────
  const addZone = () =>
    setZones(prev => [...prev, { id: uid(), label: '', price: '' }]);

  const updateZone = (id: string, patch: Partial<Zone>) =>
    setZones(prev => prev.map(z => (z.id === id ? { ...z, ...patch } : z)));

  const removeZone = (id: string) =>
    setZones(prev => prev.filter(z => z.id !== id));

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setError('');
    for (const z of zones) {
      if (!z.label.trim()) { setError('Renseigne le nom de chaque ville.'); return; }
      if (!z.price.trim() || isNaN(parseFloat(z.price))) {
        setError('Renseigne un prix valide pour chaque zone.'); return;
      }
    }
    setSaving(true);
    try {
      const rows = zones.map(z => ({
        business_id: businessId,
        label:       z.label.trim(),
        price:       parseFloat(z.price),
      }));
      const { error: dbErr } = await supabase.from('delivery_zones').insert(rows);
      if (dbErr) throw dbErr;
      // Mark business as having delivery
      await supabase
        .from('businesses')
        .update({ has_delivery: true })
        .eq('id', businessId);

      animateOut(() => onDone());
    } catch (e: any) {
      setError(e.message ?? 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  const handleDismiss = () => animateOut(() => onDismiss());

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleDismiss}>
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity }]}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={handleDismiss} />
      </Animated.View>

      {/* Centered popup */}
      <KeyboardAvoidingView
        style={StyleSheet.absoluteFill}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        pointerEvents="box-none">
        <View style={styles.centeredContainer} pointerEvents="box-none">
          <Animated.View style={[styles.popup, { transform: [{ scale }], opacity }]}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerIcon}>
                <Feather name="map-pin" size={20} color={ORANGE} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Zones de livraison</Text>
                <Text style={styles.subtitle}>
                  Ajoute les villes et le prix de livraison correspondant
                </Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={handleDismiss}>
                <Feather name="x" size={16} color="#374151" />
              </TouchableOpacity>
            </View>

            {/* Zones list */}
            <ScrollView
              style={{ maxHeight: 320 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              <View style={{ gap: 10, paddingHorizontal: 20, paddingTop: 16 }}>
                {zones.map((zone, i) => (
                  <View key={zone.id} style={styles.zoneRow}>
                    <View style={styles.zoneIndexBadge}>
                      <Text style={styles.zoneIndexTxt}>{i + 1}</Text>
                    </View>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="Ville / Région"
                      placeholderTextColor="#9CA3AF"
                      value={zone.label}
                      onChangeText={v => updateZone(zone.id, { label: v })}
                    />
                    <TextInput
                      style={[styles.input, styles.priceInput]}
                      placeholder="Prix"
                      placeholderTextColor="#9CA3AF"
                      value={zone.price}
                      onChangeText={v => updateZone(zone.id, { price: v })}
                      keyboardType="numeric"
                    />
                    {zones.length > 1 && (
                      <TouchableOpacity
                        style={styles.removeBtn}
                        onPress={() => removeZone(zone.id)}>
                        <Feather name="trash-2" size={14} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                {/* + Ajouter une zone */}
                <TouchableOpacity style={styles.addZoneBtn} onPress={addZone}>
                  <Feather name="plus" size={15} color={ORANGE} />
                  <Text style={styles.addZoneTxt}>Ajouter une zone</Text>
                </TouchableOpacity>

                {/* Error */}
                {!!error && (
                  <View style={styles.errorRow}>
                    <Feather name="alert-circle" size={13} color="#EF4444" />
                    <Text style={styles.errorTxt}>{error}</Text>
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Footer buttons */}
            <View style={styles.footer}>
              <TouchableOpacity style={styles.skipBtn} onPress={handleDismiss}>
                <Text style={styles.skipTxt}>Plus tard</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}>
                <Text style={styles.saveTxt}>
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDeliveryZoneGuard(businessId: string) {
  const [modalVisible, setModalVisible] = useState(false);

  const checkZones = useCallback(async () => {
    if (!businessId) return;
    const { count } = await supabase
      .from('delivery_zones')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId);
    if ((count ?? 0) === 0) setModalVisible(true);
  }, [businessId]);

  const DeliveryZoneModal = (
    <DeliveryZoneSetupModal
      visible={modalVisible}
      businessId={businessId}
      onDone={() => setModalVisible(false)}
      onDismiss={() => setModalVisible(false)}
    />
  );

  return { checkZones, DeliveryZoneModal };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  popup: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF2EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 1,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  zoneIndexBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneIndexTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: '#111827',
  },
  priceInput: {
    width: 80,
    textAlign: 'center',
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addZoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FDDCCA',
    backgroundColor: '#FEF2EC',
    marginTop: 2,
  },
  addZoneTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: ORANGE,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  errorTxt: {
    fontSize: 12,
    color: '#EF4444',
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  skipBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  skipTxt: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: ORANGE,
    alignItems: 'center',
  },
  saveTxt: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
