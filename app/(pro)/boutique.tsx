// app/(pro)/boutique.tsx
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Dimensions, Image, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useMyBusinesses } from '@/hooks/useBusinesses';

const { width: W } = Dimensions.get('window');
const ORANGE = '#FF6835';
const DARK   = '#1A1025';
const GREEN  = '#22C55E';

function safeUrls(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { const r = JSON.parse(raw); return Array.isArray(r) ? r : []; } catch { return []; }
}
function safeFirstUrl(raw: any): string | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    if (raw.startsWith('[')) {
      try { const a = JSON.parse(raw); return Array.isArray(a) ? a[0]??null : null; }
      catch { return null; }
    }
    return raw;
  }
  if (Array.isArray(raw)) return raw[0]??null;
  return null;
}

type ReviewFilter = 'all' | '1-3' | '4' | '5';

export default function BoutiqueTab() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const qc = useQueryClient();

  const [activeBizId,    setActiveBizId]    = useState<string | null>(null);
  const [bizPickOpen,    setBizPickOpen]    = useState(false);
  const [kindPickOpen,   setKindPickOpen]   = useState(false);

  const [reviewsMounted,   setReviewsMounted]   = useState(false);
  const [reviewsFilter,    setReviewsFilter]    = useState<ReviewFilter>('all');
  const [replyingTo,       setReplyingTo]       = useState<string | null>(null);
  const [replyText,        setReplyText]        = useState('');
  const [replySaving,      setReplySaving]      = useState(false);
  const reviewsOverlay    = useRef(new Animated.Value(0)).current;
  const reviewsTranslateY = useRef(new Animated.Value(600)).current;

  const openReviews = () => {
    setReviewsMounted(true);
    Animated.parallel([
      Animated.timing(reviewsOverlay,    { toValue:1, duration:220, useNativeDriver:true }),
      Animated.spring(reviewsTranslateY, { toValue:0, useNativeDriver:true, damping:22, stiffness:220 }),
    ]).start();
  };
  const closeReviews = () => {
    Animated.parallel([
      Animated.timing(reviewsOverlay,    { toValue:0, duration:180, useNativeDriver:true }),
      Animated.timing(reviewsTranslateY, { toValue:600, duration:200, useNativeDriver:true }),
    ]).start(() => {
      setReviewsMounted(false);
      setReplyingTo(null);
      setReplyText('');
    });
  };

  const { data: businesses = [] } = useMyBusinesses(profile?.id ?? '');
  const bizId = activeBizId ?? (businesses[0] as any)?.id ?? null;
  const biz   = (businesses as any[]).find(b => b.id === bizId) ?? businesses[0] as any;

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['catalog', bizId],
    queryFn: async () => {
      if (!bizId) return [];
      const { data } = await supabase.from('services').select('*')
        .eq('business_id', bizId).order('created_at', { ascending:false });
      return data ?? [];
    },
    enabled: !!bizId, staleTime: 30_000,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['reviews', bizId],
    queryFn: async () => {
      if (!bizId) return [];
      const { data } = await supabase
        .from('reviews')
        .select('*, profiles(id, full_name, avatar_url)')
        .eq('business_id', bizId)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!bizId && reviewsMounted,
    staleTime: 60_000,
  });

  const filteredReviews = reviews.filter((r: any) => {
    if (reviewsFilter === '1-3') return r.rating <= 3;
    if (reviewsFilter === '4')   return r.rating === 4;
    if (reviewsFilter === '5')   return r.rating === 5;
    return true;
  });

  const likeReview = async (reviewId: string, currentLikes: number) => {
    await supabase.from('reviews').update({ likes: (currentLikes ?? 0) + 1 }).eq('id', reviewId);
    qc.invalidateQueries({ queryKey: ['reviews', bizId] });
  };

  const submitReply = async (reviewId: string) => {
    if (!replyText.trim()) return;
    setReplySaving(true);
    await supabase.from('review_replies').insert({
      review_id: reviewId,
      business_id: bizId,
      author_id: profile?.id,
      content: replyText.trim(),
    });
    setReplySaving(false);
    setReplyingTo(null);
    setReplyText('');
    qc.invalidateQueries({ queryKey: ['reviews', bizId] });
  };

  const avgRating   = biz?.rating ?? 0;
  const reviewCount = biz?.review_count ?? 0;
  const displayRating = Math.max(1, Math.round(avgRating));

  const articles   = items.filter((i:any) => i.kind === 'article').slice(0, 5);
  const services   = items.filter((i:any) => i.kind === 'prestation').slice(0, 5);

  const statusBadge = (item: any) => {
    if (item.stock_quantity != null && item.stock_quantity <= 0) return { label:'Rupture', color:'#EF4444', bg:'#FEF2F2' };
    if (!item.is_available) return { label:'Inactif', color:'#9CA3AF', bg:'#F3F4F6' };
    return { label:'Actif', color:'#22C55E', bg:'#F0FDF4' };
  };

  const emoji  = biz?.category_icon ?? '🏪';
  const topPad = (Platform.OS==='ios' ? insets.top : insets.top) + 12;

  return (
    <View style={{ flex:1, backgroundColor:'#F2F2F7' }}>

      {/* ── Hero sombre ── */}
      <View style={[s.hero, { paddingTop: topPad }]}>

        {/* Nav : BOUTIQUE | sélecteur centré | settings */}
        <View style={s.heroNav}>
          {/* Titre à gauche */}
          <Text style={s.heroTitle}>Boutique</Text>

          {/* Sélecteur centré en absolu */}
          <View style={s.bizPillWrap} pointerEvents="box-none">
            <TouchableOpacity
              style={s.bizPill}
              onPress={() => businesses.length > 1 && setBizPickOpen(!bizPickOpen)}
              activeOpacity={0.8}
            >
              <Feather name="shopping-bag" size={13} color="rgba(255,255,255,0.7)" />
              <Text style={s.bizPillTxt} numberOfLines={1}>{biz?.name ?? 'Ma boutique'}</Text>
              {businesses.length > 1 && (
                <Feather name={bizPickOpen ? 'chevron-up' : 'chevron-down'} size={13} color="rgba(255,255,255,0.7)" />
              )}
            </TouchableOpacity>
          </View>

          {/* Bouton settings */}
          <TouchableOpacity
            style={s.settingsBtn}
            onPress={() => biz && router.navigate({ pathname:'/(pro)/business/settings', params:{ id:biz.id } } as any)}
          >
            <Feather name="settings" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Dropdown boutiques */}
        {bizPickOpen && businesses.length > 1 && (
          <View style={s.bizDrop}>
            {(businesses as any[]).map((b:any) => (
              <TouchableOpacity key={b.id}
                style={[s.bizDropItem, bizId===b.id && s.bizDropItemActive]}
                onPress={() => { setActiveBizId(b.id); setBizPickOpen(false); }}>
                <Text style={[s.bizDropTxt, bizId===b.id && { color:ORANGE, fontWeight:'700' }]}>{b.name}</Text>
                {bizId===b.id && <Feather name="check" size={14} color={ORANGE} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Infos boutique */}
        <View style={s.bizInfo}>
          <View style={s.bizLogoWrap}>
            {biz?.cover_url
              ? <Image source={{ uri:biz.cover_url }} style={s.bizLogo} />
              : <View style={[s.bizLogo, { backgroundColor:ORANGE, alignItems:'center', justifyContent:'center' }]}>
                  <Text style={{ fontSize:32 }}>{emoji}</Text>
                </View>}
            <View style={s.activeIndicator} />
          </View>
          <View style={{ flex:1, gap:3 }}>
            <Text style={s.bizName}>{biz?.name ?? '—'}</Text>
            <Text style={s.bizMeta}>{biz?.category ?? ''}{biz?.city ? ` · ${biz.city}` : ''}</Text>
            <TouchableOpacity
              style={{ flexDirection:'row', alignItems:'center', gap:4 }}
              activeOpacity={0.75}
              onPress={openReviews}
            >
              {[1,2,3,4,5].map(star => (
                <Feather key={star} name="star" size={12}
                  color={star<=displayRating ? '#F59E0B' : 'rgba(255,255,255,0.3)'} />
              ))}
              <Text style={s.ratingTxt}>
                {reviewCount > 0 ? `${avgRating.toFixed(1)} · ${reviewCount} avis` : 'Aucun avis'}
              </Text>
              <Feather name="chevron-right" size={11} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          </View>
        </View>

      </View>

      {/* ── Carte surélevée ── */}
      <View style={s.floatingCard}>
        <View style={{ flexDirection:'row', gap:10 }}>
          <TouchableOpacity style={[s.addBtn, { flex:1 }]}
            onPress={() => biz && setKindPickOpen(true)} activeOpacity={0.88}>
            <Feather name="plus" size={18} color="#fff" />
            <Text style={s.addBtnTxt}>Ajouter</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.catalogBtn}
            onPress={() => biz && router.navigate({ pathname:'/(pro)/business/[id]', params:{ id:biz.id } } as any)}
            activeOpacity={0.88}>
            <Feather name="grid" size={18} color={ORANGE} />
            <Text style={s.catalogBtnTxt}>Catalogue</Text>
          </TouchableOpacity>
        </View>

        <View style={s.actionsRow}>
          {[
            { icon:'shopping-bag', label:'Commandes', color:'#7C3AED', bg:'#F5F3FF',
              onPress: () => router.push('/(pro)/orders' as any) },
            { icon:'clock', label:'Horaires', color:'#059669', bg:'#F0FDF4',
              onPress: () => biz && router.push({ pathname:'/(pro)/hours', params:{ businessId:biz.id } } as any) },
            { icon:'share-2', label:'Partager', color:'#F59E0B', bg:'#FFFBEB',
              onPress: () => {} },
          ].map((a, i) => (
            <TouchableOpacity key={i} style={s.actionBtn} onPress={a.onPress} activeOpacity={0.8}>
              <View style={[s.actionIcon, { backgroundColor:a.bg }]}>
                <Feather name={a.icon as any} size={20} color={a.color} />
              </View>
              <Text style={s.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Contenu scrollable ── */}
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical:20, gap:24, paddingBottom:100 }}>

        {isLoading ? (
          <ActivityIndicator color={ORANGE} style={{ padding:40 }} />
        ) : (<>

          {articles.length > 0 && (
            <View style={{ gap:12 }}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Mes produits</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal:20, paddingVertical:4, gap:12 }}>
                {articles.map((item:any) => {
                  const st = statusBadge(item);
                  const imgUrl = safeFirstUrl(item.image_url) || safeUrls(item.image_urls)[0];
                  return (
                    <TouchableOpacity key={item.id} style={s.hCard}
                      onPress={() => biz && router.navigate({ pathname:'/(pro)/catalog/edit', params:{ businessId:biz.id, serviceId:item.id } } as any)}
                      activeOpacity={0.85}>
                      <View style={s.hCardImg}>
                        {imgUrl
                          ? <Image source={{ uri:imgUrl }} style={{ width:'100%', height:'100%', resizeMode:'cover' }} />
                          : <Text style={{ fontSize:28 }}>📦</Text>}
                      </View>
                      <View style={[s.hBadge, { backgroundColor:st.bg }]}>
                        <Text style={[s.hBadgeTxt, { color:st.color }]}>{st.label}</Text>
                      </View>
                      <Text style={s.hCardName} numberOfLines={2}>{item.title}</Text>
                      <Text style={s.hCardPrice}>{(item.price??0).toLocaleString('fr-FR')} FCFA</Text>
                      {item.stock_quantity != null && (
                        <Text style={s.hCardMeta}>{item.stock_quantity > 0 ? `${item.stock_quantity} en stock` : 'Épuisé'}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {services.length > 0 && (
            <View style={{ gap:12 }}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Mes services</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal:20, paddingVertical:4, gap:12 }}>
                {services.map((item:any) => {
                  const st = statusBadge(item);
                  const imgUrl = safeFirstUrl(item.image_url) || safeUrls(item.image_urls)[0];
                  const catLabel = item.service_category==='at_client' ? 'Domicile' : item.service_category==='hybrid' ? 'Hybride' : 'Boutique';
                  return (
                    <TouchableOpacity key={item.id} style={s.hCard}
                      onPress={() => biz && router.navigate({ pathname:'/(pro)/catalog/edit', params:{ businessId:biz.id, serviceId:item.id } } as any)}
                      activeOpacity={0.85}>
                      <View style={[s.hCardImg, { backgroundColor:'#F0FDF4' }]}>
                        {imgUrl
                          ? <Image source={{ uri:imgUrl }} style={{ width:'100%', height:'100%', resizeMode:'cover' }} />
                          : <Text style={{ fontSize:28 }}>🛎️</Text>}
                      </View>
                      <View style={[s.hBadge, { backgroundColor:st.bg }]}>
                        <Text style={[s.hBadgeTxt, { color:st.color }]}>{st.label}</Text>
                      </View>
                      <Text style={s.hCardName} numberOfLines={2}>{item.title}</Text>
                      <Text style={s.hCardPrice}>{(item.price??0).toLocaleString('fr-FR')} FCFA</Text>
                      <Text style={s.hCardMeta}>{catLabel}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {biz && (
            <View style={[s.infosCard, { marginHorizontal:20 }]}>
              <Text style={{ fontSize:16, fontWeight:'800', color:'#111827', marginBottom:4 }}>Infos boutique</Text>
              {[
                { icon:'arrow-up-right', sup:'LIEN PUBLIC',  val:biz.website || `bymoh.app/${biz.tag || biz.id?.slice(0,8)}` },
                { icon:'calendar',       sup:'CRÉÉE LE',     val:new Date(biz.created_at).toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric' }) },
                { icon:'tag',            sup:'CATÉGORIE',    val:biz.category || '—' },
              ].map((row, i) => (
                <View key={i} style={[s.infoRow, i > 0 && { borderTopWidth:1, borderTopColor:'#F3F4F6', marginTop:4, paddingTop:12 }]}>
                  <View style={s.infoIcon}><Feather name={row.icon as any} size={16} color="#6B7280" /></View>
                  <View>
                    <Text style={s.infoSup}>{row.sup}</Text>
                    <Text style={s.infoVal}>{row.val}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </>)}
      </ScrollView>

      {/* ── Modal choix type ── */}
      <Modal visible={kindPickOpen} transparent animationType="fade" onRequestClose={() => setKindPickOpen(false)}>
        <Pressable style={s.kindOverlay} onPress={() => setKindPickOpen(false)}>
          <Pressable style={s.kindSheet} onPress={e => e.stopPropagation()}>
            <View style={s.kindHandle} />
            <Text style={s.kindTitle}>Que souhaitez-vous ajouter ?</Text>
            <Text style={s.kindSub}>Choisissez le type avant de remplir le formulaire</Text>
            <View style={s.kindRow}>
              <TouchableOpacity
                style={[s.kindCard, { backgroundColor:'#FEF2EC', borderColor:'#FDDCCA' }]}
                activeOpacity={0.82}
                onPress={() => {
                  setKindPickOpen(false);
                  biz && router.navigate({ pathname:'/(pro)/catalog/edit', params:{ businessId:biz.id, defaultKind:'article' } } as any);
                }}>
                <Image source={require('@/assets/images/article.png')} style={s.kindCardImg} resizeMode="contain" />
                <View style={{ flex:1 }}>
                  <Text style={s.kindCardTitle}>Article</Text>
                  <Text style={s.kindCardSub}>Produit physique avec stock & livraison</Text>
                </View>
                <Feather name="chevron-right" size={18} color={ORANGE} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.kindCard, { backgroundColor:'#F0FDF4', borderColor:'#BBF7D0' }]}
                activeOpacity={0.82}
                onPress={() => {
                  setKindPickOpen(false);
                  biz && router.navigate({ pathname:'/(pro)/catalog/edit', params:{ businessId:biz.id, defaultKind:'prestation' } } as any);
                }}>
                <Image source={require('@/assets/images/s_stars.png')} style={s.kindCardImg} resizeMode="contain" />
                <View style={{ flex:1 }}>
                  <Text style={[s.kindCardTitle, { color:'#16A34A' }]}>Service</Text>
                  <Text style={s.kindCardSub}>Prestation réalisée sur rendez-vous</Text>
                </View>
                <Feather name="chevron-right" size={18} color="#16A34A" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.kindCancel} onPress={() => setKindPickOpen(false)}>
              <Text style={s.kindCancelTxt}>Annuler</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Modal Avis ── */}
      <Modal visible={reviewsMounted} transparent animationType="none" onRequestClose={closeReviews}>
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor:'rgba(0,0,0,0.55)' }, { opacity: reviewsOverlay }]}
          pointerEvents="box-none">
          <TouchableOpacity style={{ flex:1 }} activeOpacity={1} onPress={closeReviews} />
        </Animated.View>

        <Animated.View style={[r.sheet, { paddingBottom: insets.bottom + 16 }, { transform:[{ translateY: reviewsTranslateY }] }]}>
          <View style={r.handle} />
          <View style={r.header}>
            <View>
              <Text style={r.title}>Avis clients</Text>
              <Text style={r.sub}>
                {reviewCount > 0 ? `${avgRating.toFixed(1)} ★ · ${reviewCount} avis` : 'Aucun avis pour le moment'}
              </Text>
            </View>
            <TouchableOpacity onPress={closeReviews} style={r.closeBtn}>
              <Feather name="x" size={18} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={r.filtersRow}>
            {([
              { key:'all', label:'Tous' },
              { key:'1-3', label:'1 – 3 ★' },
              { key:'4',   label:'4 ★' },
              { key:'5',   label:'5 ★' },
            ] as { key:ReviewFilter; label:string }[]).map(f => (
              <TouchableOpacity
                key={f.key}
                style={[r.filterChip, reviewsFilter===f.key && r.filterChipActive]}
                onPress={() => setReviewsFilter(f.key)}
                activeOpacity={0.8}>
                <Text style={[r.filterTxt, reviewsFilter===f.key && r.filterTxtActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:16, gap:14 }} showsVerticalScrollIndicator={false}>
            {filteredReviews.length === 0 ? (
              <View style={r.emptyWrap}>
                <Feather name="message-square" size={36} color="#D1D5DB" />
                <Text style={r.emptyTxt}>Aucun avis dans cette catégorie</Text>
              </View>
            ) : filteredReviews.map((rev:any) => (
              <View key={rev.id} style={r.card}>
                <View style={r.cardTop}>
                  <View style={r.avatar}>
                    {rev.profiles?.avatar_url
                      ? <Image source={{ uri:rev.profiles.avatar_url }} style={{ width:36, height:36, borderRadius:18 }} />
                      : <Text style={{ fontSize:18 }}>👤</Text>}
                  </View>
                  <View style={{ flex:1 }}>
                    <Text style={r.authorName}>{rev.profiles?.full_name ?? 'Anonyme'}</Text>
                    <View style={{ flexDirection:'row', gap:2, marginTop:2 }}>
                      {[1,2,3,4,5].map(s => (
                        <Feather key={s} name="star" size={11} color={s<=rev.rating ? '#F59E0B' : '#E5E7EB'} />
                      ))}
                    </View>
                  </View>
                  <Text style={r.date}>
                    {rev.created_at ? new Date(rev.created_at).toLocaleDateString('fr-FR', { day:'numeric', month:'short' }) : ''}
                  </Text>
                </View>
                {rev.comment ? <Text style={r.comment}>{rev.comment}</Text> : null}
                <View style={r.cardActions}>
                  <TouchableOpacity style={r.actionChip} activeOpacity={0.75}
                    onPress={() => likeReview(rev.id, rev.likes ?? 0)}>
                    <Feather name="thumbs-up" size={13} color="#6B7280" />
                    <Text style={r.actionTxt}>{rev.likes ?? 0}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={r.actionChip} activeOpacity={0.75}
                    onPress={() => { setReplyingTo(replyingTo===rev.id ? null : rev.id); setReplyText(''); }}>
                    <Feather name="message-circle" size={13} color="#6B7280" />
                    <Text style={r.actionTxt}>Répondre</Text>
                  </TouchableOpacity>
                </View>
                {replyingTo === rev.id && (
                  <View style={r.replyBox}>
                    <TextInput
                      style={r.replyInput}
                      placeholder="Votre réponse..."
                      placeholderTextColor="#9CA3AF"
                      value={replyText}
                      onChangeText={setReplyText}
                      multiline
                      autoFocus
                    />
                    <View style={{ flexDirection:'row', gap:8, justifyContent:'flex-end', marginTop:8 }}>
                      <TouchableOpacity style={r.cancelBtn}
                        onPress={() => { setReplyingTo(null); setReplyText(''); }}>
                        <Text style={r.cancelTxt}>Annuler</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[r.sendBtn, (!replyText.trim() || replySaving) && { opacity:0.5 }]}
                        onPress={() => submitReply(rev.id)}
                        disabled={!replyText.trim() || replySaving}>
                        {replySaving
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <Text style={r.sendTxt}>Envoyer</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      </Modal>

    </View>
  );
}

const s = StyleSheet.create({
  hero:          { backgroundColor:DARK, paddingBottom:68, paddingHorizontal:16 },
  heroNav:       { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:16 },
  // Titre à gauche
  heroTitle:     { fontSize:17, fontWeight:'800', color:'#fff' },
  // Sélecteur centré en absolu
  bizPillWrap:   { position:'absolute', left:0, right:0, alignItems:'center' },
  bizPill:       { flexDirection:'row', alignItems:'center', gap:6, backgroundColor:'rgba(255,255,255,0.12)', borderRadius:100, paddingHorizontal:12, paddingVertical:7, borderWidth:1, borderColor:'rgba(255,255,255,0.15)' },
  bizPillTxt:    { fontSize:13, fontWeight:'700', color:'rgba(255,255,255,0.85)', maxWidth:120 },
  settingsBtn:   { width:38, height:38, borderRadius:19, backgroundColor:'rgba(255,255,255,0.1)', alignItems:'center', justifyContent:'center' },
  bizDrop:       { backgroundColor:'rgba(255,255,255,0.1)', borderRadius:14, overflow:'hidden', marginBottom:12, borderWidth:1, borderColor:'rgba(255,255,255,0.12)' },
  bizDropItem:   { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:13, borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.08)' },
  bizDropItemActive: { backgroundColor:'rgba(255,104,53,0.15)' },
  bizDropTxt:    { fontSize:14, color:'rgba(255,255,255,0.8)', fontWeight:'600' },
  bizInfo:       { flexDirection:'row', alignItems:'flex-start', gap:14, marginBottom:20 },
  bizLogoWrap:   { position:'relative' },
  bizLogo:       { width:72, height:72, borderRadius:20, overflow:'hidden', resizeMode:'cover' },
  activeIndicator: { position:'absolute', bottom:2, right:2, width:12, height:12, borderRadius:6, backgroundColor:GREEN, borderWidth:2, borderColor:DARK },
  bizName:       { fontSize:20, fontWeight:'900', color:'#fff' },
  bizMeta:       { fontSize:12, color:'rgba(255,255,255,0.55)' },
  ratingTxt:     { fontSize:12, color:'rgba(255,255,255,0.6)', fontWeight:'600' },
  kpiRow:        { flexDirection:'row', gap:10 },
  kpiCard:       { flex:1, backgroundColor:'rgba(255,255,255,0.06)', borderRadius:16, padding:12, gap:4, borderWidth:1 },
  kpiIcon:       { width:36, height:36, borderRadius:10, alignItems:'center', justifyContent:'center', marginBottom:4 },
  kpiValue:      { fontSize:22, fontWeight:'900' },
  kpiLabel:      { fontSize:11, color:'rgba(255,255,255,0.5)', fontWeight:'600' },
  floatingCard:  { marginHorizontal:16, marginTop:-48, backgroundColor:'#fff', borderRadius:24, padding:16, gap:14, borderWidth:1, borderColor:'#F0F0F0' },
  addBtn:        { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:ORANGE, borderRadius:16, paddingVertical:16 },
  addBtnTxt:     { fontSize:15, fontWeight:'700', color:'#fff' },
  catalogBtn:    { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:'#FEF2EC', borderRadius:16, paddingVertical:16, paddingHorizontal:20, borderWidth:1.5, borderColor:'#FDDCCA' },
  catalogBtnTxt: { fontSize:15, fontWeight:'700', color:ORANGE },
  actionsRow:    { flexDirection:'row' },
  actionBtn:     { flex:1, alignItems:'center', gap:6 },
  actionIcon:    { width:48, height:48, borderRadius:24, alignItems:'center', justifyContent:'center' },
  actionLabel:   { fontSize:12, fontWeight:'600', color:'#374151' },
  sectionHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20 },
  sectionTitle:  { fontSize:18, fontWeight:'800', color:'#111827' },
  sectionLink:   { fontSize:13, fontWeight:'600', color:ORANGE },
  hCard:         { width:140, backgroundColor:'#fff', borderRadius:18, overflow:'hidden', borderWidth:1, borderColor:'#F0F0F0', padding:12, gap:4 },
  hCardImg:      { width:'100%', height:100, borderRadius:12, backgroundColor:'#F3F4F6', alignItems:'center', justifyContent:'center', overflow:'hidden', marginBottom:6 },
  hBadge:        { alignSelf:'flex-start', paddingHorizontal:8, paddingVertical:3, borderRadius:100 },
  hBadgeTxt:     { fontSize:10, fontWeight:'700' },
  hCardName:     { fontSize:13, fontWeight:'700', color:'#111827', lineHeight:18 },
  hCardPrice:    { fontSize:13, fontWeight:'700', color:ORANGE },
  hCardMeta:     { fontSize:11, color:'#9CA3AF' },
  badge:         { paddingHorizontal:10, paddingVertical:4, borderRadius:100 },
  badgeTxt:      { fontSize:11, fontWeight:'700' },
  emptyHoriz:    { alignItems:'center', paddingVertical:28, gap:8, paddingHorizontal:20 },
  emptyTxt:      { fontSize:13, fontWeight:'600', color:'#9CA3AF' },
  emptyWrap:     { alignItems:'center', paddingVertical:40 },
  kindOverlay:   { flex:1, backgroundColor:'rgba(0,0,0,0.55)', alignItems:'center', justifyContent:'center', padding:24 },
  kindSheet:     { width:'100%', backgroundColor:'#fff', borderRadius:28, padding:24, alignItems:'center', gap:16, shadowColor:'#000', shadowOffset:{ width:0, height:12 }, shadowOpacity:0.18, shadowRadius:32, elevation:20 },
  kindHandle:    { width:40, height:4, borderRadius:2, backgroundColor:'#E5E7EB', marginBottom:4 },
  kindTitle:     { fontSize:20, fontWeight:'800', color:'#111827', textAlign:'center' },
  kindSub:       { fontSize:13, color:'#9CA3AF', textAlign:'center', marginTop:-8 },
  kindRow:       { flexDirection:'column', gap:10, width:'100%' },
  kindCard:      { flexDirection:'row', alignItems:'center', gap:14, borderRadius:18, padding:14, borderWidth:1.5 },
  kindCardImg:   { width:52, height:52, borderRadius:12 },
  kindCardTitle: { fontSize:16, fontWeight:'800', color:'#111827', marginBottom:2 },
  kindCardSub:   { fontSize:12, color:'#6B7280', lineHeight:17 },
  kindCancel:    { paddingVertical:14, paddingHorizontal:32, borderRadius:14, backgroundColor:'#F3F4F6', width:'100%', alignItems:'center' },
  kindCancelTxt: { fontSize:15, fontWeight:'700', color:'#6B7280' },
  infosCard:     { backgroundColor:'#fff', borderRadius:20, padding:18, gap:10 },
  infoRow:       { flexDirection:'row', alignItems:'center', gap:12 },
  infoIcon:      { width:36, height:36, borderRadius:10, backgroundColor:'#F3F4F6', alignItems:'center', justifyContent:'center', flexShrink:0 },
  infoSup:       { fontSize:10, fontWeight:'700', color:'#9CA3AF', letterSpacing:0.8 },
  infoVal:       { fontSize:14, fontWeight:'600', color:'#111827', marginTop:1 },
});

const r = StyleSheet.create({
  sheet:        { position:'absolute', bottom:0, left:0, right:0, height:'82%', backgroundColor:'#fff', borderTopLeftRadius:28, borderTopRightRadius:28, overflow:'hidden' },
  handle:       { width:40, height:4, borderRadius:2, backgroundColor:'#E5E7EB', alignSelf:'center', marginTop:12, marginBottom:4 },
  header:       { flexDirection:'row', alignItems:'flex-start', justifyContent:'space-between', paddingHorizontal:20, paddingTop:12, paddingBottom:8 },
  title:        { fontSize:20, fontWeight:'800', color:'#111827' },
  sub:          { fontSize:13, color:'#9CA3AF', marginTop:2 },
  closeBtn:     { width:34, height:34, borderRadius:17, backgroundColor:'#F3F4F6', alignItems:'center', justifyContent:'center' },
  filtersRow:   { paddingHorizontal:16, gap:8, paddingBottom:12, flexDirection:'row', alignItems:'center' },
  filterChip:   { paddingHorizontal:14, paddingVertical:7, borderRadius:100, backgroundColor:'#F3F4F6', borderWidth:1.5, borderColor:'transparent', alignSelf:'flex-start' },
  filterChipActive: { backgroundColor:'#FEF2EC', borderColor:'#FDDCCA' },
  filterTxt:    { fontSize:13, fontWeight:'600', color:'#6B7280' },
  filterTxtActive:  { color:ORANGE },
  emptyWrap:    { alignItems:'center', paddingVertical:48, gap:10 },
  emptyTxt:     { fontSize:14, color:'#9CA3AF', fontWeight:'600' },
  card:         { backgroundColor:'#FAFAFA', borderRadius:18, padding:14, borderWidth:1, borderColor:'#F3F4F6', gap:10 },
  cardTop:      { flexDirection:'row', alignItems:'flex-start', gap:10 },
  avatar:       { width:36, height:36, borderRadius:18, backgroundColor:'#F3F4F6', alignItems:'center', justifyContent:'center', overflow:'hidden' },
  authorName:   { fontSize:14, fontWeight:'700', color:'#111827' },
  date:         { fontSize:11, color:'#9CA3AF', marginTop:2 },
  comment:      { fontSize:14, color:'#374151', lineHeight:20 },
  cardActions:  { flexDirection:'row', gap:8 },
  actionChip:   { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:12, paddingVertical:6, borderRadius:100, backgroundColor:'#F3F4F6' },
  actionTxt:    { fontSize:12, fontWeight:'600', color:'#6B7280' },
  replyBox:     { backgroundColor:'#F9FAFB', borderRadius:14, padding:12, borderWidth:1, borderColor:'#E5E7EB' },
  replyInput:   { fontSize:14, color:'#111827', minHeight:64, textAlignVertical:'top', lineHeight:20 },
  cancelBtn:    { paddingHorizontal:16, paddingVertical:8, borderRadius:10, backgroundColor:'#F3F4F6' },
  cancelTxt:    { fontSize:13, fontWeight:'600', color:'#6B7280' },
  sendBtn:      { paddingHorizontal:16, paddingVertical:8, borderRadius:10, backgroundColor:ORANGE },
  sendTxt:      { fontSize:13, fontWeight:'700', color:'#fff' },
});
