// components/pro/ServiceCategoryPicker.tsx
import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Image, Modal, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type ServiceCategory = 'at_merchant' | 'at_client' | 'hybrid';

interface CatInfo {
  id: ServiceCategory; icon: any; label: string;
  desc: string; examples: string; color: string; bg: string;
}

export const SERVICE_CATEGORIES: CatInfo[] = [
  {
    id:       'at_merchant',
    icon:     require('@/assets/images/pick-up_icon.png'),
    label:    'Chez le marchand',
    desc:     'Le client se deplace dans votre boutique ou local',
    examples: 'Coiffure, restaurant, couture, reparation...',
    color:    '#FF6835',
    bg:       '#FEF2EC',
  },
  {
    id:       'at_client',
    icon:     require('@/assets/images/delivery_icon.png'),
    label:    'Chez le client',
    desc:     'Vous vous deplacez chez le client',
    examples: 'Massage, plomberie, electricite, menage...',
    color:    '#7C3AED',
    bg:       '#F5F3FF',
  },
  {
    id:       'hybrid',
    icon:     require('@/assets/images/pick-del_icon.png'),
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

  const [mounted, setMounted] = useState(false);
  const overlayOpacity  = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(500)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(overlayOpacity,  { toValue:1, duration:220, useNativeDriver:true }),
        Animated.spring(sheetTranslateY, { toValue:0, useNativeDriver:true, damping:22, stiffness:220 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlayOpacity,  { toValue:0, duration:180, useNativeDriver:true }),
        Animated.timing(sheetTranslateY, { toValue:500, duration:200, useNativeDriver:true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(overlayOpacity,  { toValue:0, duration:180, useNativeDriver:true }),
      Animated.timing(sheetTranslateY, { toValue:500, duration:200, useNativeDriver:true }),
    ]).start(() => { setMounted(false); onClose(); });
  };

  const handleSelect = (cat: ServiceCategory) => {
    Animated.parallel([
      Animated.timing(overlayOpacity,  { toValue:0, duration:180, useNativeDriver:true }),
      Animated.timing(sheetTranslateY, { toValue:500, duration:200, useNativeDriver:true }),
    ]).start(() => { setMounted(false); onSelect(cat); onClose(); });
  };

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={handleClose}>
      {/* Fond — fondu doux */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor:'rgba(0,0,0,0.55)' }, { opacity: overlayOpacity }]}
        pointerEvents="box-none">
        <TouchableOpacity style={{ flex:1 }} activeOpacity={1} onPress={handleClose}/>
      </Animated.View>

      {/* Sheet — glisse depuis le bas */}
      <Animated.View style={[s.sheet, { paddingBottom: insets.bottom + 20 }, { transform:[{ translateY: sheetTranslateY }] }]}>
        <View style={s.handle}/>
        <Text style={s.title}>Quel type de service ?</Text>
        <Text style={s.sub}>Choisissez la categorie pour adapter le formulaire</Text>

        {SERVICE_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[s.card, { borderColor: cat.color + '40' }]}
            onPress={() => handleSelect(cat.id)}
            activeOpacity={0.85}>
            <View style={[s.iconWrap, { backgroundColor: cat.bg }]}>
              <Image source={cat.icon} style={{ width:30, height:30 }} resizeMode="contain"/>
            </View>
            <View style={{ flex:1 }}>
              <Text style={[s.cardLabel, { color: cat.color }]}>{cat.label}</Text>
              <Text style={s.cardDesc}>{cat.desc}</Text>
              <Text style={s.cardExamples}>{cat.examples}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={cat.color}/>
          </TouchableOpacity>
        ))}
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
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
