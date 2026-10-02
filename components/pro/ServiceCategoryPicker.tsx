// components/pro/ServiceCategoryPicker.tsx
import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type ServiceCategory = 'at_merchant' | 'at_client' | 'hybrid';

interface CatInfo {
  id: ServiceCategory; emoji: string; label: string;
  desc: string; examples: string; color: string; bg: string;
}

export const SERVICE_CATEGORIES: CatInfo[] = [
  {
    id:       'at_merchant',
    emoji:    '🏪',
    label:    'Chez le marchand',
    desc:     'Le client se deplace dans votre boutique ou local',
    examples: 'Coiffure, restaurant, couture, reparation...',
    color:    '#1E3A5F',
    bg:       '#EEF2FF',
  },
  {
    id:       'at_client',
    emoji:    '🏠',
    label:    'Chez le client',
    desc:     'Vous vous deplacez chez le client',
    examples: 'Massage, plomberie, electricite, menage...',
    color:    '#7C3AED',
    bg:       '#F5F3FF',
  },
  {
    id:       'hybrid',
    emoji:    '🔄',
    label:    'Hybride',
    desc:     'Disponible en boutique ou a domicile',
    examples: 'Coaching, consultation, cours particuliers...',
    color:    '#059669',
    bg:       '#F0FDF4',
  },
];

interface Props {
  visible:  boolean;
  onClose:  () => void;
  onSelect: (cat: ServiceCategory) => void;
}

export function ServiceCategoryPicker({ visible, onClose, onSelect }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={[s.sheet, { paddingBottom: insets.bottom + 20 }]}>
        <View style={s.handle} />
        <Text style={s.title}>Quel type de service ?</Text>
        <Text style={s.sub}>Choisissez la categorie pour adapter le formulaire</Text>

        {SERVICE_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[s.card, { borderColor: cat.color + '40' }]}
            onPress={() => { onSelect(cat.id); onClose(); }}
            activeOpacity={0.85}
          >
            <View style={[s.iconWrap, { backgroundColor: cat.bg }]}>
              <Text style={{ fontSize: 26 }}>{cat.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.cardLabel, { color: cat.color }]}>{cat.label}</Text>
              <Text style={s.cardDesc}>{cat.desc}</Text>
              <Text style={s.cardExamples}>{cat.examples}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={cat.color} />
          </TouchableOpacity>
        ))}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop:     { position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.55)' },
  sheet:        { position:'absolute', bottom:0, left:0, right:0, backgroundColor:'#fff', borderTopLeftRadius:24, borderTopRightRadius:24, padding:20, gap:12 },
  handle:       { width:40, height:4, borderRadius:2, backgroundColor:'#E5E7EB', alignSelf:'center', marginBottom:4 },
  title:        { fontSize:20, fontWeight:'800', color:'#111827' },
  sub:          { fontSize:13, color:'#9CA3AF', marginTop:-4 },
  card:         { flexDirection:'row', alignItems:'center', gap:14, backgroundColor:'#FAFAFA', borderRadius:16, padding:14, borderWidth:1.5 },
  iconWrap:     { width:52, height:52, borderRadius:16, alignItems:'center', justifyContent:'center' },
  cardLabel:    { fontSize:15, fontWeight:'800' },
  cardDesc:     { fontSize:13, color:'#374151', marginTop:2, lineHeight:17 },
  cardExamples: { fontSize:11, color:'#9CA3AF', marginTop:3, fontStyle:'italic' },
});
