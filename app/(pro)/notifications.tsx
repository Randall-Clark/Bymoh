// app/(pro)/notifications.tsx
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Modal, Platform, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

const DARK   = '#111827';
const ORANGE = '#FF6835';

type NotifType =
  'new_order'|'payment'|'order_cancelled'|'low_stock'|
  'new_review'|'delivery'|'booking'|'refund'|'other';

interface Notif {
  id:         string;
  type:       NotifType;
  title:      string;
  body:       string;
  data?:      Record<string,any>;
  is_read:    boolean;
  read_at?:   string;
  created_at: string;
}

// Icône + couleur par type
const TYPE_STYLE: Record<NotifType,{icon:string; color:string; bg:string}> = {
  new_order:      { icon:'shopping-bag', color:'#FF6835', bg:'#FEF2EC' },
  payment:        { icon:'credit-card',  color:'#22C55E', bg:'#F0FDF4' },
  order_cancelled:{ icon:'x-circle',     color:'#EF4444', bg:'#FEF2F2' },
  low_stock:      { icon:'alert-triangle',color:'#F59E0B', bg:'#FEF3C7' },
  new_review:     { icon:'star',          color:'#F59E0B', bg:'#FFFBEB' },
  delivery:       { icon:'truck',         color:'#3B82F6', bg:'#EFF6FF' },
  booking:        { icon:'calendar',      color:'#8B5CF6', bg:'#F5F3FF' },
  refund:         { icon:'rotate-ccw',    color:'#6366F1', bg:'#EEF2FF' },
  other:          { icon:'bell',          color:'#9CA3AF', bg:'#F3F4F6' },
};

function fmtTime(d: string) {
  const date = new Date(d);
  const now  = new Date();
  const diff = (now.getTime()-date.getTime())/1000;
  if (diff < 60)         return 'À l\'instant';
  if (diff < 3600)       return `Il y a ${Math.round(diff/60)} min`;
  if (diff < 86400)      return `Il y a ${Math.round(diff/3600)} h`;
  if (diff < 172800)     return `Hier, ${date.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}`;
  return date.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
}

export default function NotificationsScreen() {
  const insets  = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const qc      = useQueryClient();
  const topPad  = (Platform.OS==='ios'?insets.top:insets.top)+8;
  const [selected, setSelected] = useState<Notif|null>(null);

  // ── Données réelles ────────────────────────────────────────────────────────
  const { data: notifs = [], isLoading } = useQuery({
    queryKey: ['notifications', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile!.id)
        .order('created_at', { ascending: false })
        .limit(80);
      return (data ?? []) as Notif[];
    },
    enabled: !!profile?.id, staleTime: 0,
  });

  // ── Temps réel ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel('realtime-notifs')
      .on('postgres_changes', {
        event:'*', schema:'public', table:'notifications',
        filter:`user_id=eq.${profile.id}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ['notifications', profile.id] });
        qc.invalidateQueries({ queryKey: ['notif-count', profile.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id]);

  // ── Nettoyage 24h des lues ─────────────────────────────────────────────────
  useEffect(() => {
    if (!profile?.id) return;
    // Supprimer les notifications lues depuis +24h
    const cutoff = new Date(Date.now()-24*3600*1000).toISOString();
    supabase.from('notifications')
      .delete()
      .eq('user_id', profile.id)
      .eq('is_read', true)
      .lt('read_at', cutoff)
      .then(()=>qc.invalidateQueries({queryKey:['notifications',profile.id]}));
  }, [profile?.id]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const markRead = async (n: Notif) => {
    setSelected(n);
    if (!n.is_read) {
      await supabase.from('notifications').update({ is_read:true }).eq('id', n.id);
      qc.invalidateQueries({ queryKey:['notifications', profile?.id] });
      qc.invalidateQueries({ queryKey:['notif-count', profile?.id] });
    }
  };

  const markAllRead = async () => {
    await supabase.from('notifications')
      .update({ is_read:true })
      .eq('user_id', profile!.id)
      .eq('is_read', false);
    qc.invalidateQueries({ queryKey:['notifications', profile?.id] });
    qc.invalidateQueries({ queryKey:['notif-count', profile?.id] });
  };

  const unread = notifs.filter(n => !n.is_read);
  const read   = notifs.filter(n => n.is_read);

  const renderNotif = (n: Notif) => {
    const st = TYPE_STYLE[n.type] ?? TYPE_STYLE.other;
    return (
      <TouchableOpacity key={n.id} style={[s.card, !n.is_read&&s.cardUnread]}
        onPress={()=>markRead(n)} activeOpacity={0.82}>
        <View style={[s.iconWrap,{backgroundColor:st.bg}]}>
          <Feather name={st.icon as any} size={22} color={st.color}/>
        </View>
        <View style={{flex:1,gap:3}}>
          <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
            <Text style={[s.title,!n.is_read&&{color:DARK,fontWeight:'800'}]} numberOfLines={1}>
              {n.title}
            </Text>
            {!n.is_read&&<View style={s.dot}/>}
          </View>
          <Text style={s.body} numberOfLines={2}>{n.body}</Text>
          <Text style={s.time}>{fmtTime(n.created_at)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{flex:1,backgroundColor:'#F2F2F7'}}>

      {/* Header */}
      <View style={[s.header,{paddingTop:topPad}]}>
        <TouchableOpacity style={s.backBtn} onPress={()=>router.back()}>
          <Feather name="chevron-left" size={22} color="#fff"/>
        </TouchableOpacity>
        <View style={{flex:1}}>
          <Text style={s.headerTitle}>Notifications</Text>
          {unread.length>0&&(
            <Text style={s.headerSub}>{unread.length} non lue{unread.length>1?'s':''}</Text>
          )}
        </View>
        {unread.length>0&&(
          <TouchableOpacity style={s.markAllBtn} onPress={markAllRead}>
            <Text style={s.markAllTxt}>Tout marquer lu</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator color={ORANGE} style={{padding:40}}/>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={{paddingVertical:16,gap:8,paddingBottom:60}}>

          {/* Nouvelles */}
          {unread.length>0&&(
            <>
              <Text style={s.sectionLabel}>NOUVELLES — {unread.length}</Text>
              {unread.map(renderNotif)}
            </>
          )}

          {/* Précédentes */}
          {read.length>0&&(
            <>
              <Text style={[s.sectionLabel,unread.length>0&&{marginTop:8}]}>PRÉCÉDENTES</Text>
              {read.map(renderNotif)}
            </>
          )}

          {notifs.length===0&&(
            <View style={{alignItems:'center',paddingVertical:80,gap:14}}>
              <View style={{width:72,height:72,borderRadius:36,backgroundColor:'#F3F4F6',alignItems:'center',justifyContent:'center'}}>
                <Feather name="bell-off" size={32} color="#D1D5DB"/>
              </View>
              <Text style={{fontSize:16,fontWeight:'700',color:'#374151'}}>Aucune notification</Text>
              <Text style={{fontSize:13,color:'#9CA3AF'}}>Vous êtes à jour !</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Modal détail notification ── */}
      <Modal visible={!!selected} transparent animationType="fade"
        onRequestClose={()=>setSelected(null)}>
        <TouchableOpacity style={s.modalBg} activeOpacity={1} onPress={()=>setSelected(null)}/>
        {selected&&(()=>{
          const st = TYPE_STYLE[selected.type]??TYPE_STYLE.other;
          return (
            <View style={[s.detailSheet,{paddingBottom:insets.bottom+24}]}>
              <View style={s.detailHandle}/>

              {/* Icône + titre */}
              <View style={{alignItems:'center',gap:12,paddingVertical:8}}>
                <View style={[s.detailIcon,{backgroundColor:st.bg}]}>
                  <Feather name={st.icon as any} size={32} color={st.color}/>
                </View>
                <Text style={s.detailTitle}>{selected.title}</Text>
                <Text style={s.detailTime}>{fmtTime(selected.created_at)}</Text>
              </View>

              {/* Corps */}
              <View style={s.detailBody}>
                <Text style={s.detailBodyTxt}>{selected.body}</Text>
              </View>

              {/* Actions contextuelles */}
              {selected.type==='new_order'&&selected.data?.order_id&&(
                <TouchableOpacity style={s.detailBtn}
                  onPress={()=>{setSelected(null);router.navigate({pathname:'/(pro)/orders/[id]',params:{id:selected.data!.order_id}} as any);}}>
                  <Feather name="shopping-bag" size={16} color="#fff"/>
                  <Text style={s.detailBtnTxt}>Voir la commande</Text>
                </TouchableOpacity>
              )}
              {selected.type==='booking'&&selected.data?.booking_id&&(
                <TouchableOpacity style={[s.detailBtn,{backgroundColor:'#8B5CF6'}]}
                  onPress={()=>{setSelected(null);router.navigate({pathname:'/(pro)/bookings/[id]',params:{id:selected.data!.booking_id}} as any);}}>
                  <Feather name="calendar" size={16} color="#fff"/>
                  <Text style={s.detailBtnTxt}>Voir la réservation</Text>
                </TouchableOpacity>
              )}
              {selected.type==='low_stock'&&(
                <TouchableOpacity style={[s.detailBtn,{backgroundColor:'#F59E0B'}]}
                  onPress={()=>{setSelected(null);router.navigate('/(pro)/boutique' as any);}}>
                  <Feather name="package" size={16} color="#fff"/>
                  <Text style={s.detailBtnTxt}>Gérer le stock</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={s.detailClose} onPress={()=>setSelected(null)}>
                <Text style={s.detailCloseTxt}>Fermer</Text>
              </TouchableOpacity>
            </View>
          );
        })()}
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  header:        { backgroundColor:DARK, flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:16, paddingBottom:16 },
  backBtn:       { width:38, height:38, borderRadius:19, backgroundColor:'rgba(255,255,255,0.1)', alignItems:'center', justifyContent:'center' },
  headerTitle:   { fontSize:22, fontWeight:'900', color:'#fff' },
  headerSub:     { fontSize:12, color:'rgba(255,255,255,0.5)', marginTop:1 },
  markAllBtn:    { backgroundColor:'rgba(255,255,255,0.12)', borderRadius:100, paddingHorizontal:14, paddingVertical:8, borderWidth:1, borderColor:'rgba(255,255,255,0.2)' },
  markAllTxt:    { fontSize:12, fontWeight:'700', color:'rgba(255,255,255,0.85)' },
  sectionLabel:  { fontSize:11, fontWeight:'700', color:'#9CA3AF', letterSpacing:1.2, paddingHorizontal:16 },
  card:          { flexDirection:'row', alignItems:'flex-start', gap:14, backgroundColor:'#fff', marginHorizontal:16, borderRadius:18, padding:16, shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.04, shadowRadius:4, elevation:1 },
  cardUnread:    { borderLeftWidth:3, borderLeftColor:ORANGE },
  iconWrap:      { width:50, height:50, borderRadius:16, alignItems:'center', justifyContent:'center', flexShrink:0 },
  title:         { fontSize:14, fontWeight:'700', color:'#374151', flex:1 },
  body:          { fontSize:13, color:'#6B7280', lineHeight:18 },
  time:          { fontSize:11, color:'#9CA3AF', fontWeight:'500' },
  dot:           { width:9, height:9, borderRadius:5, backgroundColor:'#EF4444', flexShrink:0, marginTop:3 },
  // Modal
  modalBg:       { ...StyleSheet.absoluteFill, backgroundColor:'rgba(0,0,0,0.5)' },
  detailSheet:   { position:'absolute', bottom:0, left:0, right:0, backgroundColor:'#fff', borderTopLeftRadius:28, borderTopRightRadius:28, paddingHorizontal:24, paddingTop:8, gap:16 },
  detailHandle:  { width:40, height:4, borderRadius:2, backgroundColor:'#E5E7EB', alignSelf:'center', marginBottom:4 },
  detailIcon:    { width:72, height:72, borderRadius:24, alignItems:'center', justifyContent:'center' },
  detailTitle:   { fontSize:20, fontWeight:'900', color:DARK, textAlign:'center' },
  detailTime:    { fontSize:12, color:'#9CA3AF', textAlign:'center' },
  detailBody:    { backgroundColor:'#F9FAFB', borderRadius:16, padding:16 },
  detailBodyTxt: { fontSize:14, color:'#374151', lineHeight:22 },
  detailBtn:     { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:ORANGE, borderRadius:16, paddingVertical:15 },
  detailBtnTxt:  { fontSize:15, fontWeight:'700', color:'#fff' },
  detailClose:   { alignItems:'center', paddingVertical:8 },
  detailCloseTxt:{ fontSize:14, color:'#9CA3AF', fontWeight:'600' },
});
