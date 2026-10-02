// app/(pro)/orders/[id].tsx
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Linking, Platform,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

const ORANGE  = '#FF6835';
const DARK    = '#111827';
const INDIGO  = '#6366F1';
const GREEN   = '#22C55E';
const RED     = '#EF4444';

type OrderStatus = 'pending' | 'confirmed' | 'in_progress' | 'delivered' | 'cancelled';

const STATUS_INFO: Record<OrderStatus, { label:string; color:string; bg:string }> = {
  pending:     { label:'En attente',  color:'#F59E0B', bg:'#FEF3C7' },
  confirmed:   { label:'Confirmée',   color:'#3B82F6', bg:'#EFF6FF' },
  in_progress: { label:'En cours',    color:INDIGO,    bg:'#EEF2FF' },
  delivered:   { label:'Livrée',      color:GREEN,     bg:'#F0FDF4' },
  cancelled:   { label:'Annulée',     color:'#9CA3AF', bg:'#F3F4F6' },
};

const STEPS: { key: OrderStatus; label: string }[] = [
  { key:'pending',     label:'Reçue'     },
  { key:'confirmed',   label:'Confirmée' },
  { key:'in_progress', label:'En cours'  },
  { key:'delivered',   label:'Livrée'    },
];

function stepIndex(status: OrderStatus) {
  const idx = STEPS.findIndex(s => s.key === status);
  return idx === -1 ? 0 : idx;
}

function fmtDate(d: string) {
  const date = new Date(d);
  const now  = new Date();
  const diff = (now.getTime()-date.getTime())/(1000*60*60*24);
  const time = date.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  if (diff < 1) return `Aujourd'hui, ${time}`;
  if (diff < 2) return `Hier, ${time}`;
  return `${date.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}, ${time}`;
}

function getInitials(name: string) {
  return name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
}

const AVATAR_COLORS = ['#8B5CF6','#3B82F6','#10B981','#F59E0B','#EF4444','#EC4899'];
function getAvatarColor(name: string) {
  return AVATAR_COLORS[name.split('').reduce((s,c)=>s+c.charCodeAt(0),0)%AVATAR_COLORS.length];
}

export default function OrderDetailScreen() {
  const insets  = useSafeAreaInsets();
  const qc      = useQueryClient();
  const { id }  = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const topPad  = (Platform.OS==='ios'?insets.top:insets.top)+8;

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('*, items:order_items(*, service:services(title, kind, image_url, image_urls, price))')
        .eq('id', id!)
        .single();
      return data;
    },
    enabled: !!id, staleTime: 0, refetchOnMount: 'always',
  });

  const updateStatus = async (newStatus: OrderStatus) => {
    setLoading(true);
    try {
      await supabase.from('orders').update({ status: newStatus }).eq('id', id!);
      await qc.invalidateQueries({ queryKey: ['order', id] });
      await qc.invalidateQueries({ queryKey: ['pro-orders'] });
      await qc.invalidateQueries({ queryKey: ['dash-curr'] });
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setLoading(false);
    }
  };

  const confirmOrder = () =>
    Alert.alert('Confirmer la commande', 'Accepter et préparer cette commande ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Confirmer', onPress: () => updateStatus('confirmed') },
    ]);

  const sendDelivery = () =>
    Alert.alert('Envoyer en livraison', 'La commande est prête et en cours de livraison ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Envoyer', onPress: () => updateStatus('in_progress') },
    ]);

  const cancelOrder = () =>
    Alert.alert('Annuler la commande', 'Cette action initiera le remboursement du client. Continuer ?', [
      { text: 'Non', style: 'cancel' },
      { text: 'Annuler la commande', style: 'destructive',
        onPress: () => updateStatus('cancelled') },
    ]);

  if (isLoading || !order) {
    return (
      <View style={{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'#F2F2F7'}}>
        <ActivityIndicator color={ORANGE} size="large"/>
      </View>
    );
  }

  const status    = (order.status ?? 'pending') as OrderStatus;
  const st        = STATUS_INFO[status] ?? STATUS_INFO.pending;
  const curStep   = stepIndex(status);
  const items     = (order.items ?? []) as any[];
  const subtotal  = items.reduce((s:number,i:any)=>s+((i.service?.price??0)*(i.quantity??1)),0);
  const delivery  = order.delivery_fee ?? 0;
  const total     = order.total_amount ?? subtotal+delivery;
  const name      = order.customer_name ?? order.client_name ?? 'Client';
  const address   = order.delivery_address ?? order.address ?? '';
  const orderNum  = `#${id?.slice(-4).toUpperCase() ?? '0000'}`;
  const note      = order.client_note ?? order.note ?? '';

  const safeImgUrl = (raw: any): string | undefined => {
    if (!raw) return undefined;
    if (typeof raw === 'string') {
      if (raw.startsWith('[')) { try { const a = JSON.parse(raw); return a[0]||undefined; } catch { return undefined; } }
      return raw;
    }
    if (Array.isArray(raw)) return raw[0]||undefined;
    return undefined;
  };

  return (
    <View style={{flex:1,backgroundColor:'#F2F2F7'}}>

      {/* ── Header ── */}
      <View style={[s.header,{paddingTop:topPad}]}>
        <TouchableOpacity style={s.backBtn} onPress={()=>router.back()}>
          <Feather name="chevron-left" size={22} color="#fff"/>
        </TouchableOpacity>
        <View style={{flex:1}}>
          <Text style={s.headerTitle}>Commande {orderNum}</Text>
          <Text style={s.headerSub}>{fmtDate(order.created_at)}</Text>
        </View>
        <View style={[s.statusPill,{backgroundColor:'rgba(255,255,255,0.15)',borderColor:st.color+'50',borderWidth:1}]}>
          <Text style={[s.statusPillTxt,{color:'#fff'}]}>{st.label}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{padding:16,gap:12,paddingBottom:120}}>

        {/* ── Client ── */}
        <View style={s.card}>
          <View style={{flexDirection:'row',alignItems:'center',gap:14}}>
            <View style={[s.avatar,{backgroundColor:getAvatarColor(name)}]}>
              <Text style={s.avatarTxt}>{getInitials(name)}</Text>
            </View>
            <View style={{flex:1}}>
              <Text style={s.clientName}>{name}</Text>
              {!!address&&<Text style={s.clientAddr}>{address}</Text>}
            </View>
            {!!order.client_phone&&(
              <TouchableOpacity style={s.contactBtn}
                onPress={()=>Linking.openURL(`tel:${order.client_phone}`)}>
                <Feather name="arrow-up-right" size={18} color={DARK}/>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Suivi ── */}
        {status !== 'cancelled' && (
          <View style={s.card}>
            <Text style={s.sectionLabel}>SUIVI</Text>
            <View style={{flexDirection:'row',alignItems:'flex-start',marginTop:8}}>
              {STEPS.map((step,i)=>{
                const done    = i <= curStep;
                const current = i === curStep;
                const isLast  = i === STEPS.length-1;
                return (
                  <React.Fragment key={step.key}>
                    <View style={{alignItems:'center',gap:6}}>
                      <View style={[s.stepCircle, done&&{backgroundColor:ORANGE,borderColor:ORANGE}]}>
                        {done
                          ? <Feather name="check" size={12} color="#fff"/>
                          : <View style={{width:8,height:8,borderRadius:4,backgroundColor:'#E5E7EB'}}/>}
                      </View>
                      <Text style={[s.stepLabel, current&&{color:ORANGE,fontWeight:'700'},
                        !done&&{color:'#9CA3AF'}]}>
                        {step.label}
                      </Text>
                    </View>
                    {!isLast&&(
                      <View style={[s.stepLine,i<curStep&&{backgroundColor:ORANGE}]}/>
                    )}
                  </React.Fragment>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Livraison ── */}
        {!!address&&(
          <View style={s.card}>
            <View style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:10}}>
              <Text style={{fontSize:16}}>🚚</Text>
              <Text style={s.sectionLabel}>LIVRAISON À DOMICILE</Text>
            </View>
            {[
              {label:'Adresse',          val:address},
              {label:'Créneau souhaité', val:order.delivery_slot??'Non précisé'},
              {label:'Livreur',          val:order.livreur_name??'Non assigné'},
            ].map((row,i)=>(
              <View key={i} style={[s.infoRow,i>0&&{borderTopWidth:1,borderTopColor:'#F9FAFB'}]}>
                <Text style={s.infoLabel}>{row.label}</Text>
                <Text style={s.infoVal}>{row.val}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Articles ── */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>ARTICLES</Text>
          <View style={{gap:12,marginTop:8}}>
            {items.map((item:any,i:number)=>{
              const imgUrl = safeImgUrl(item.service?.image_url) || safeImgUrl(item.service?.image_urls);
              const price  = (item.service?.price??0)*(item.quantity??1);
              return (
                <View key={i} style={{flexDirection:'row',alignItems:'center',gap:12}}>
                  <View style={s.itemImg}>
                    {imgUrl
                      ? <Image source={{uri:imgUrl}} style={{width:44,height:44,resizeMode:'cover'}}/>
                      : <Text style={{fontSize:22}}>{item.service?.kind==='prestation'?'🛎️':'📦'}</Text>}
                  </View>
                  <View style={{flex:1}}>
                    <Text style={{fontSize:14,fontWeight:'700',color:DARK}}>
                      {item.service?.title??'Article'}
                    </Text>
                    <Text style={{fontSize:12,color:'#9CA3AF'}}>
                      {(item.service?.price??0).toLocaleString('fr-FR')} FCFA × {item.quantity??1}
                    </Text>
                  </View>
                  <Text style={{fontSize:14,fontWeight:'800',color:DARK}}>
                    {price.toLocaleString('fr-FR')}{' '}
                    <Text style={{fontSize:11,fontWeight:'400',color:'#9CA3AF'}}>FCFA</Text>
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={s.divider}/>

          {[
            {label:'Sous-total articles', val:subtotal, bold:false},
            {label:'Frais de livraison',  val:delivery, bold:false, color:'#9CA3AF'},
          ].map((row,i)=>(
            <View key={i} style={s.totalRow}>
              <Text style={[s.totalLabel,row.color&&{color:row.color}]}>{row.label}</Text>
              <Text style={s.totalVal}>{row.val.toLocaleString('fr-FR')} FCFA</Text>
            </View>
          ))}
          <View style={[s.totalRow,{marginTop:4}]}>
            <Text style={{fontSize:15,fontWeight:'800',color:DARK}}>Total</Text>
            <View style={{flexDirection:'row',alignItems:'baseline',gap:4}}>
              <Text style={{fontSize:20,fontWeight:'900',color:DARK}}>
                {total.toLocaleString('fr-FR')}
              </Text>
              <Text style={{fontSize:12,color:'#9CA3AF',fontWeight:'600'}}>FCFA</Text>
            </View>
          </View>
        </View>

        {/* ── Paiement ── */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>PAIEMENT</Text>
          <View style={{gap:0,marginTop:8}}>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Statut</Text>
              <View style={[s.statusPill,{backgroundColor:st.bg,borderWidth:0}]}>
                <Text style={[s.statusPillTxt,{color:st.color}]}>{st.label}</Text>
              </View>
            </View>
            <View style={[s.infoRow,{borderTopWidth:1,borderTopColor:'#F9FAFB'}]}>
              <Text style={s.infoLabel}>Méthode</Text>
              <Text style={[s.infoVal,{fontWeight:'700'}]}>
                📱 {order.payment_method ?? 'Mobile Money'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Note client ── */}
        {!!note&&(
          <View style={s.noteCard}>
            <View style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:6}}>
              <Text style={{fontSize:16}}>💬</Text>
              <Text style={s.sectionLabel}>NOTE DU CLIENT</Text>
            </View>
            <Text style={s.noteTxt}>"{note}"</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Actions ── */}
      {status !== 'delivered' && status !== 'cancelled' && (
        <View style={[s.actionsBar,{paddingBottom:insets.bottom+16}]}>

          {status === 'pending' && (
            <TouchableOpacity style={[s.mainBtn,{backgroundColor:INDIGO},loading&&{opacity:0.7}]}
              onPress={confirmOrder} disabled={loading} activeOpacity={0.88}>
              {loading
                ? <ActivityIndicator color="#fff"/>
                : <>
                    <Feather name="check-circle" size={20} color="#fff"/>
                    <Text style={s.mainBtnTxt}>Confirmer la commande</Text>
                  </>}
            </TouchableOpacity>
          )}

          {status === 'confirmed' && (
            <TouchableOpacity style={[s.mainBtn,{backgroundColor:ORANGE},loading&&{opacity:0.7}]}
              onPress={sendDelivery} disabled={loading} activeOpacity={0.88}>
              {loading
                ? <ActivityIndicator color="#fff"/>
                : <>
                    <Text style={{fontSize:18}}>🚚</Text>
                    <Text style={s.mainBtnTxt}>Envoyer en livraison</Text>
                  </>}
            </TouchableOpacity>
          )}

          {status === 'in_progress' && (
            <View style={s.waitingBox}>
              <Feather name="clock" size={18} color={INDIGO}/>
              <Text style={{fontSize:14,fontWeight:'600',color:INDIGO}}>
                En attente de livraison — validation par le client
              </Text>
            </View>
          )}

          {(status === 'pending' || status === 'confirmed') && (
            <TouchableOpacity style={s.cancelLink} onPress={cancelOrder} disabled={loading}>
              <Text style={s.cancelTxt}>Annuler la commande</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Statut final */}
      {(status === 'delivered' || status === 'cancelled') && (
        <View style={[s.actionsBar,{paddingBottom:insets.bottom+16}]}>
          <View style={[s.finalBox,{backgroundColor:status==='delivered'?'#F0FDF4':'#F3F4F6'}]}>
            <Feather name={status==='delivered'?'check-circle':'x-circle'} size={20}
              color={status==='delivered'?GREEN:'#9CA3AF'}/>
            <Text style={{fontSize:14,fontWeight:'700',
              color:status==='delivered'?GREEN:'#6B7280'}}>
              Commande {status==='delivered'?'livrée avec succès':'annulée'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header:       { backgroundColor:DARK, flexDirection:'row', alignItems:'center', gap:14, paddingHorizontal:16, paddingBottom:16 },
  backBtn:      { width:38, height:38, borderRadius:19, backgroundColor:'rgba(255,255,255,0.12)', alignItems:'center', justifyContent:'center' },
  headerTitle:  { fontSize:18, fontWeight:'900', color:'#fff' },
  headerSub:    { fontSize:12, color:'rgba(255,255,255,0.55)', marginTop:1 },
  statusPill:   { borderRadius:100, paddingHorizontal:12, paddingVertical:6 },
  statusPillTxt:{ fontSize:12, fontWeight:'700' },
  card:         { backgroundColor:'#fff', borderRadius:20, padding:16, shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.05, shadowRadius:4, elevation:2 },
  avatar:       { width:48, height:48, borderRadius:24, alignItems:'center', justifyContent:'center', flexShrink:0 },
  avatarTxt:    { fontSize:16, fontWeight:'800', color:'#fff' },
  clientName:   { fontSize:16, fontWeight:'800', color:DARK },
  clientAddr:   { fontSize:12, color:'#9CA3AF', marginTop:2 },
  contactBtn:   { width:36, height:36, borderRadius:18, backgroundColor:'#F3F4F6', alignItems:'center', justifyContent:'center' },
  sectionLabel: { fontSize:11, fontWeight:'700', color:'#9CA3AF', letterSpacing:1 },
  stepCircle:   { width:28, height:28, borderRadius:14, borderWidth:2, borderColor:'#E5E7EB', backgroundColor:'#fff', alignItems:'center', justifyContent:'center' },
  stepLine:     { flex:1, height:2, backgroundColor:'#E5E7EB', marginTop:13, marginHorizontal:4 },
  stepLabel:    { fontSize:11, fontWeight:'600', color:DARK, textAlign:'center', maxWidth:60 },
  infoRow:      { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:10 },
  infoLabel:    { fontSize:13, color:'#9CA3AF' },
  infoVal:      { fontSize:13, color:DARK, fontWeight:'500', textAlign:'right', flex:1, marginLeft:16 },
  itemImg:      { width:44, height:44, borderRadius:12, backgroundColor:'#F3F4F6', overflow:'hidden', alignItems:'center', justifyContent:'center', flexShrink:0 },
  divider:      { height:1, backgroundColor:'#F3F4F6', marginVertical:12 },
  totalRow:     { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:3 },
  totalLabel:   { fontSize:13, color:'#6B7280' },
  totalVal:     { fontSize:13, fontWeight:'600', color:DARK },
  noteCard:     { backgroundColor:'#FFFBEB', borderRadius:20, padding:16, borderWidth:1, borderColor:'#FDE68A' },
  noteTxt:      { fontSize:14, color:'#78350F', fontStyle:'italic', lineHeight:20 },
  actionsBar:   { backgroundColor:'#fff', paddingHorizontal:20, paddingTop:16, borderTopWidth:1, borderTopColor:'#F3F4F6', gap:12 },
  mainBtn:      { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10, borderRadius:18, paddingVertical:17 },
  mainBtnTxt:   { fontSize:16, fontWeight:'700', color:'#fff' },
  cancelLink:   { alignItems:'center', paddingVertical:4 },
  cancelTxt:    { fontSize:14, color:'#9CA3AF', fontWeight:'600' },
  waitingBox:   { flexDirection:'row', alignItems:'center', gap:10, backgroundColor:'#EEF2FF', borderRadius:14, padding:14 },
  finalBox:     { flexDirection:'row', alignItems:'center', gap:10, borderRadius:14, padding:14 },
});
