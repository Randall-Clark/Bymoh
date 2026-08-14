// components/TimePicker.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions, Modal,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_H } = Dimensions.get('window');

const ITEM_H  = 48;
const VISIBLE = 5;
const WHEEL_H = ITEM_H * VISIBLE;

// ✅ Toutes les heures et TOUTES les minutes (0-59)
const HOURS   = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

// ── Roue de défilement ────────────────────────────────────────────────────────
function TimeWheel({
  items,
  selectedIndex,
  onChange,
  wheelKey,  // ← key externe pour forcer le scroll initial
}: {
  items: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  wheelKey?: string;
}) {
  const ref       = useRef<ScrollView>(null);
  const lastIndex = useRef(selectedIndex);

  // ✅ Scroll vers la valeur correcte à chaque fois que wheelKey change (= nouvelle ouverture)
  useEffect(() => {
    const timer = setTimeout(() => {
      ref.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: false });
    }, 80);
    return () => clearTimeout(timer);
  }, [wheelKey]);

  const handleScrollEnd = (e: any) => {
    const y     = e.nativeEvent.contentOffset.y;
    const index = Math.max(0, Math.min(items.length - 1, Math.round(y / ITEM_H)));
    if (index !== lastIndex.current) {
      lastIndex.current = index;
      onChange(index);
    }
  };

  return (
    <View style={wh.wrap}>
      <View style={wh.selector} pointerEvents="none" />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        contentContainerStyle={{ paddingVertical: ITEM_H * Math.floor(VISIBLE / 2) }}
        style={{ height: WHEEL_H }}
        scrollEventThrottle={16}
      >
        {items.map((item, i) => {
          const selected = i === selectedIndex;
          return (
            <View key={i} style={wh.item}>
              <Text style={[wh.text, selected && wh.textSelected]}>{item}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const wh = StyleSheet.create({
  wrap:         { flex: 1, position: 'relative', overflow: 'hidden' },
  selector:     {
    position: 'absolute',
    top: ITEM_H * Math.floor(VISIBLE / 2),
    left: 0, right: 0, height: ITEM_H,
    backgroundColor: 'rgba(255,104,53,0.08)',
    borderTopWidth: 1.5, borderBottomWidth: 1.5,
    borderColor: '#FF6835', borderRadius: 8, zIndex: 10,
  },
  item:         { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  text:         { fontSize: 18, fontWeight: '400', color: '#C4C9D4' },
  textSelected: { fontSize: 24, fontWeight: '800', color: '#111827' },
});

// ── Modal TimePicker ──────────────────────────────────────────────────────────
interface Props {
  visible:   boolean;
  title:     string;
  value:     string;       // "HH:MM"
  onConfirm: (time: string) => void;
  onClose:   () => void;
}

export function TimePicker({ visible, title, value, onConfirm, onClose }: Props) {
  const insets  = useSafeAreaInsets();
  const slideY  = useRef(new Animated.Value(400)).current;
  // ✅ Clé unique par ouverture — force le re-scroll des roues
  const [openKey, setOpenKey] = useState('');

  const parseHour = (v: string) => {
    const h = parseInt(v.split(':')[0], 10);
    return Math.max(0, Math.min(23, isNaN(h) ? 0 : h));
  };
  const parseMin = (v: string) => {
    const m = parseInt(v.split(':')[1] ?? '0', 10);
    return Math.max(0, Math.min(59, isNaN(m) ? 0 : m));
  };

  const [hourIndex,   setHourIndex]   = useState(() => parseHour(value));
  const [minuteIndex, setMinuteIndex] = useState(() => parseMin(value));

  useEffect(() => {
    if (visible) {
      // ✅ Reset aux valeurs du champ actuellement édité (pas celui d'avant)
      setHourIndex(parseHour(value));
      setMinuteIndex(parseMin(value));
      // ✅ Nouvelle clé → force les roues à scroller vers la bonne position
      setOpenKey(`${value}-${Date.now()}`);
      Animated.spring(slideY, { toValue: 0, tension: 80, friction: 14, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideY, { toValue: 400, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible, value]);

  const confirm = () => {
    onConfirm(`${HOURS[hourIndex]}:${MINUTES[minuteIndex]}`);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose} statusBarTranslucent>
      <TouchableOpacity style={tp.backdrop} activeOpacity={1} onPress={onClose} />

      <Animated.View style={[tp.sheet, { transform: [{ translateY: slideY }], paddingBottom: insets.bottom + 16 }]}>
        <View style={tp.handle} />

        {/* Header */}
        <View style={tp.header}>
          <TouchableOpacity onPress={onClose} style={tp.sideBtn}>
            <Text style={tp.cancelText}>Annuler</Text>
          </TouchableOpacity>
          <Text style={tp.title}>{title}</Text>
          <TouchableOpacity onPress={confirm} style={tp.sideBtn}>
            <Text style={tp.confirmText}>OK</Text>
          </TouchableOpacity>
        </View>

        {/* Roues */}
        <View style={tp.wheelsRow}>
          {/* Heures */}
          <View style={{ flex: 1 }}>
            <Text style={tp.colLabel}>Heure</Text>
            <TimeWheel
              items={HOURS}
              selectedIndex={hourIndex}
              onChange={setHourIndex}
              wheelKey={`h-${openKey}`}
            />
          </View>

          <View style={tp.colon}>
            <Text style={tp.colonText}>:</Text>
          </View>

          {/* Minutes — toutes les 60 */}
          <View style={{ flex: 1 }}>
            <Text style={tp.colLabel}>Min</Text>
            <TimeWheel
              items={MINUTES}
              selectedIndex={minuteIndex}
              onChange={setMinuteIndex}
              wheelKey={`m-${openKey}`}
            />
          </View>
        </View>

        {/* Aperçu */}
        <View style={tp.preview}>
          <Text style={tp.previewText}>
            {HOURS[hourIndex]}:{MINUTES[minuteIndex]}
          </Text>
        </View>
      </Animated.View>
    </Modal>
  );
}

const tp = StyleSheet.create({
  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: 24, gap: 14 },
  handle:      { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 2 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sideBtn:     { paddingVertical: 4, paddingHorizontal: 4, minWidth: 64 },
  cancelText:  { fontSize: 15, color: '#9CA3AF', fontWeight: '600' },
  title:       { fontSize: 17, fontWeight: '800', color: '#111827', textAlign: 'center' },
  confirmText: { fontSize: 15, color: '#FF6835', fontWeight: '700', textAlign: 'right' },
  wheelsRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F7F4', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, gap: 8 },
  colLabel:    { textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  colon:       { paddingTop: 28, alignItems: 'center', width: 20 },
  colonText:   { fontSize: 28, fontWeight: '800', color: '#374151' },
  preview:     { alignItems: 'center', backgroundColor: '#FEF2EC', borderRadius: 14, paddingVertical: 10 },
  previewText: { fontSize: 22, fontWeight: '800', color: '#FF6835', letterSpacing: 1 },
});
