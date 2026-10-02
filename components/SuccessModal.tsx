// components/SuccessModal.tsx
import React, { useEffect, useRef } from 'react';
import {
  Animated, Modal, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

interface Props {
  visible:  boolean;
  title?:   string;
  message?: string;
  onClose:  () => void;
}

export function SuccessModal({
  visible,
  title   = 'Succes',
  message = 'Action effectuee avec succes !',
  onClose,
}: Props) {
  const scale   = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1, tension: 80, friction: 10, useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1, duration: 200, useNativeDriver: true,
        }),
      ]).start();
    } else {
      scale.setValue(0.7);
      opacity.setValue(0);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none"
      onRequestClose={onClose}>
      <View style={s.backdrop}>
        <Animated.View style={[s.card, { transform: [{ scale }], opacity }]}>
          {/* Icône */}
          <View style={s.iconWrap}>
            <Feather name="check" size={28} color="#22C55E" />
          </View>

          {/* Texte */}
          <Text style={s.title}>{title}</Text>
          <Text style={s.message}>{message}</Text>

          {/* Bouton */}
          <TouchableOpacity style={s.btn} onPress={onClose} activeOpacity={0.88}>
            <Text style={s.btnTxt}>OK</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex:1, backgroundColor:'rgba(0,0,0,0.45)', alignItems:'center', justifyContent:'center', padding:32 },
  card:     { width:'100%', backgroundColor:'#fff', borderRadius:24, padding:28, alignItems:'center', gap:12, shadowColor:'#000', shadowOffset:{width:0,height:12}, shadowOpacity:0.18, shadowRadius:24, elevation:16 },
  iconWrap: { width:72, height:72, borderRadius:36, backgroundColor:'#F0FDF4', borderWidth:2, borderColor:'#BBF7D0', alignItems:'center', justifyContent:'center', marginBottom:4 },
  title:    { fontSize:20, fontWeight:'800', color:'#111827', textAlign:'center' },
  message:  { fontSize:14, color:'#6B7280', textAlign:'center', lineHeight:20 },
  btn:      { width:'100%', backgroundColor:'#22C55E', borderRadius:14, paddingVertical:15, alignItems:'center', marginTop:8 },
  btnTxt:   { fontSize:16, fontWeight:'700', color:'#fff' },
});
