// components/pro/AvailabilityModal.tsx
// Modal de configuration des créneaux — utilisable avant ET après publication
import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Modal, Platform, ScrollView, StyleSheet,
  Switch, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TimePicker } from '@/components/TimePicker';

// ── Helpers ────────────────────────────────────────────────────────────────────
function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function minToTime(m: number): string {
  return `${Math.floor(m/60).toString().padStart(2,'0')}:${(m%60).toString().padStart(2,'0')}`;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function toDateStr(d: Date): string { return d.toISOString().slice(0, 10); }

const DAY_FULL  = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
const DAY_ENUM  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// Retourne les heures d'ouverture d'un jour JS (0=dim) depuis business_hours
function getBizHours(dayJs: number, bh?: BusinessHour[]): { open: string; close: string } | null {
  if (!bh || bh.length === 0) return null;
  const dayKey = DAY_ENUM[dayJs];
  const h = bh.find((d) => d.day_of_week === dayKey);
  if (!h || h.is_closed) return null;
  return { open: h.open_time.slice(0,5), close: h.close_time.slice(0,5) };
}

// Clamp une heure dans la plage d'ouverture
function clampTime(time: string, bizOpen: string, bizClose: string): string {
  if (time < bizOpen)  return bizOpen;
  if (time > bizClose) return bizClose;
  return time;
}

type Mode = 'workweek' | 'week' | 'weekend' | 'now' | 'custom';

const MODES: { id: Mode; emoji: string; label: string; desc: string; days: number[] }[] = [
  { id:'workweek', emoji:'💼', label:'Lun – Ven',       desc:'Du lundi au vendredi', days:[1,2,3,4,5] },
  { id:'week',     emoji:'📅', label:'Toute la semaine',desc:'Du lundi au dimanche',  days:[0,1,2,3,4,5,6] },
  { id:'weekend',  emoji:'🎉', label:'Week-end',         desc:'Samedi et dimanche',    days:[0,6] },
  { id:'now',      emoji:'⚡', label:'Maintenant',       desc:'Un seul créneau aujourd\'hui', days:[] },
  { id:'custom',   emoji:'⚙️', label:'Personnaliser',    desc:'Configurer jour par jour',    days:[] },
];

export interface SlotConfig {
  date:       string;
  start_time: string;
  end_time:   string;
  max_slots:  number;
}

function generateSlots(params: {
  dates: string[]; openTime: string; closeTime: string;
  durationMin: number; breakMin: number; maxSlots: number;
}): SlotConfig[] {
  const { dates, openTime, closeTime, durationMin, breakMin, maxSlots } = params;
  const interval = durationMin + breakMin;
  const result: SlotConfig[] = [];
  for (const date of dates) {
    let cur = timeToMin(openTime);
    const end = timeToMin(closeTime);
    while (cur + durationMin <= end) {
      result.push({ date, start_time: minToTime(cur), end_time: minToTime(cur + durationMin), max_slots: maxSlots });
      cur += interval;
    }
  }
  return result;
}

// ── Props ────────────────────────────────────────────────────────────────────
interface BusinessHour {
  day_of_week: string; // 'Mon','Tue',...
  open_time:   string;
  close_time:  string;
  is_closed:   boolean;
}

interface Props {
  visible:        boolean;
  durationMin?:   number;
  businessHours?: BusinessHour[]; // heures d'ouverture de la boutique
  onClose:        () => void;
  onConfirm:      (slots: SlotConfig[]) => void;
  existingCount?: number;
}

export function AvailabilityModal({ visible, durationMin = 60, businessHours, onClose, onConfirm, existingCount = 0 }: Props) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top + 16;

  const [mode,       setMode]       = useState<Mode>('workweek');
  const [openTime,   setOpenTime]   = useState('08:00');
  const [closeTime,  setCloseTime]  = useState('18:00');
  const [breakMin,   setBreakMin]   = useState(15);
  const [maxSlots,   setMaxSlots]   = useState(1);
  const [weeksAhead, setWeeksAhead] = useState(2);

  const [customDays, setCustomDays] = useState<Record<number,{enabled:boolean;open:string;close:string}>>({
    0:{enabled:false,open:'08:00',close:'18:00'},
    1:{enabled:true, open:'08:00',close:'18:00'},
    2:{enabled:true, open:'08:00',close:'18:00'},
    3:{enabled:true, open:'08:00',close:'18:00'},
    4:{enabled:true, open:'08:00',close:'18:00'},
    5:{enabled:true, open:'08:00',close:'18:00'},
    6:{enabled:false,open:'08:00',close:'18:00'},
  });

  const [openPicker,   setOpenPicker]   = useState(false);
  const [closePicker,  setClosePicker]  = useState(false);
  const [customPicker, setCustomPicker] = useState<{day:number;which:'open'|'close'}|null>(null);

  // ── Génération ──────────────────────────────────────────────────────────
  const computeSlots = (): SlotConfig[] => {
    if (mode === 'now') {
      const now    = new Date();
      const curMin = now.getHours() * 60 + now.getMinutes();
      const start  = minToTime(Math.ceil(curMin / 15) * 15 + 15);
      return [{ date: toDateStr(now), start_time: start,
        end_time: minToTime(timeToMin(start) + durationMin), max_slots: maxSlots }];
    }
    if (mode === 'custom') {
      const result: SlotConfig[] = [];
      const today = new Date();
      for (const [dn, cfg] of Object.entries(customDays)) {
        if (!cfg.enabled) continue;
        const dates: string[] = [];
        for (let i = 0; i < weeksAhead * 7; i++) {
          const d = addDays(today, i);
          if (d.getDay() === parseInt(dn)) dates.push(toDateStr(d));
        }
        result.push(...generateSlots({ dates, openTime: cfg.open, closeTime: cfg.close,
          durationMin, breakMin, maxSlots }));
      }
      return result;
    }
    const modeObj = MODES.find((m) => m.id === mode)!;
    const result: SlotConfig[] = [];
    const today = new Date();
    for (let i = 0; i < weeksAhead * 7; i++) {
      const d = addDays(today, i);
      if (!modeObj.days.includes(d.getDay())) continue;
      // Restreindre aux heures d'ouverture de la boutique
      const bh = getBizHours(d.getDay(), businessHours);
      const effOpen  = bh ? clampTime(openTime,  bh.open, bh.close) : openTime;
      const effClose = bh ? clampTime(closeTime, bh.open, bh.close) : closeTime;
      result.push(...generateSlots({ dates:[toDateStr(d)], openTime:effOpen,
        closeTime:effClose, durationMin, breakMin, maxSlots }));
    }
    return result;
  };

  const slots   = computeSlots();
  const count   = slots.length;
  const modeObj = MODES.find((m) => m.id === mode)!;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={[s.root, { paddingTop: topPad }]}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <Feather name="x" size={20} color="#374151" />
          </TouchableOpacity>
          <Text style={s.title}>Configurer les créneaux</Text>
          {existingCount > 0 && (
            <Text style={s.existingBadge}>{existingCount} existants</Text>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 100 }]}
          keyboardShouldPersistTaps="handled">

          {/* Info durée */}
          <View style={s.durationInfo}>
            <Feather name="clock" size={14} color="#FF6835" />
            <Text style={s.durationTxt}>
              Durée : <Text style={{ fontWeight:'700' }}>{durationMin} min</Text>
              {' '}· Les créneaux seront dans les heures d'ouverture de la boutique.
            </Text>
          </View>
          {businessHours && businessHours.length > 0 && (
            <View style={s.bizHoursInfo}>
              <Feather name="info" size={13} color="#1E3A5F" />
              <Text style={s.bizHoursInfoTxt}>
                Les créneaux seront automatiquement restreints aux heures d'ouverture définies pour chaque jour.
              </Text>
            </View>
          )}

          {/* Sélecteur de mode */}
          <Text style={s.sectionTitle}>Répétition</Text>
          <View style={s.modeGrid}>
            {MODES.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[s.modeCard, mode === m.id && s.modeCardActive]}
                onPress={() => setMode(m.id)}
                activeOpacity={0.8}
              >
                <Text style={s.modeEmoji}>{m.emoji}</Text>
                <Text style={[s.modeLabel, mode === m.id && {color:'#FF6835',fontWeight:'700'}]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.modeDesc}>{modeObj.desc}</Text>

          {/* Horaires globaux */}
          {mode !== 'custom' && mode !== 'now' && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Plage horaire</Text>
              <View style={s.timeRow}>
                <View style={{flex:1}}>
                  <Text style={s.fieldLabel}>Ouverture</Text>
                  <TouchableOpacity style={s.timeBtn} onPress={() => setOpenPicker(true)}>
                    <Feather name="clock" size={14} color="#FF6835" />
                    <Text style={s.timeTxt}>{openTime}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={s.timeSep}>→</Text>
                <View style={{flex:1}}>
                  <Text style={s.fieldLabel}>Fermeture</Text>
                  <TouchableOpacity style={s.timeBtn} onPress={() => setClosePicker(true)}>
                    <Feather name="clock" size={14} color="#FF6835" />
                    <Text style={s.timeTxt}>{closeTime}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Mode personnalisé */}
          {mode === 'custom' && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Configuration par jour</Text>
              {[1,2,3,4,5,6,0].map((dn) => {
                const cfg = customDays[dn];
                return (
                  <View key={dn} style={[s.dayCard, !cfg.enabled && {opacity:0.45}]}>
                    <View style={s.dayHeader}>
                      <Text style={[s.dayName, cfg.enabled && {color:'#111827',fontWeight:'700'}]}>
                        {DAY_FULL[dn]}
                      </Text>
                      <Switch value={cfg.enabled}
                        onValueChange={(v) => setCustomDays(p => ({...p,[dn]:{...p[dn],enabled:v}}))}
                        trackColor={{false:'#E5E7EB',true:'#FF6835'}} thumbColor="#fff"
                        style={{transform:[{scaleX:.8},{scaleY:.8}]}}/>
                    </View>
                    {cfg.enabled && (
                      <View style={s.timeRow}>
                        <TouchableOpacity style={[s.timeBtn,{flex:1}]}
                          onPress={() => setCustomPicker({day:dn,which:'open'})}>
                          <Text style={s.timeTxt}>{cfg.open}</Text>
                        </TouchableOpacity>
                        <Text style={s.timeSep}>–</Text>
                        <TouchableOpacity style={[s.timeBtn,{flex:1}]}
                          onPress={() => setCustomPicker({day:dn,which:'close'})}>
                          <Text style={s.timeTxt}>{cfg.close}</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Pause */}
          {mode !== 'now' && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Pause entre créneaux</Text>
              <View style={s.chips}>
                {[0,10,15,20,30].map((min) => (
                  <TouchableOpacity key={min}
                    style={[s.chip, breakMin===min && s.chipActive]}
                    onPress={() => setBreakMin(min)}>
                    <Text style={[s.chipTxt, breakMin===min && {color:'#FF6835',fontWeight:'700'}]}>
                      {min === 0 ? 'Aucune' : `${min} min`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Durée planification */}
          {mode !== 'now' && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Planifier sur</Text>
              <View style={s.chips}>
                {[1,2,4,8].map((w) => (
                  <TouchableOpacity key={w}
                    style={[s.chip, weeksAhead===w && s.chipActive]}
                    onPress={() => setWeeksAhead(w)}>
                    <Text style={[s.chipTxt, weeksAhead===w && {color:'#FF6835',fontWeight:'700'}]}>
                      {w} sem.
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Places par créneau */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Places par créneau</Text>
            <View style={s.qtyRow}>
              <TouchableOpacity style={s.qtyBtn} onPress={() => setMaxSlots(Math.max(1, maxSlots-1))}>
                <Feather name="minus" size={14} color="#374151"/>
              </TouchableOpacity>
              <Text style={s.qtyVal}>{maxSlots}</Text>
              <TouchableOpacity style={s.qtyBtn} onPress={() => setMaxSlots(maxSlots+1)}>
                <Feather name="plus" size={14} color="#374151"/>
              </TouchableOpacity>
              <Text style={s.qtyHint}>personne{maxSlots>1?'s':''} max par créneau</Text>
            </View>
          </View>

          {/* Preview */}
          <View style={[s.preview, count===0 && {backgroundColor:'#FEE2E2',borderColor:'#FECACA'}]}>
            <Feather name="calendar" size={16} color={count>0?'#FF6835':'#EF4444'}/>
            <View style={{flex:1}}>
              <Text style={[s.previewTitle, count===0 && {color:'#EF4444'}]}>
                {count > 0
                  ? `${count} créneau${count>1?'x':''} de ${durationMin} min`
                  : 'Aucun créneau possible avec ces paramètres'}
              </Text>
              {count > 0 && mode !== 'now' && (
                <Text style={s.previewSub}>
                  {openTime} → {closeTime} · pause {breakMin} min · {weeksAhead} sem.
                </Text>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={[s.footer, {paddingBottom: insets.bottom + 8}]}>
          <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
            <Text style={s.cancelBtnTxt}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.confirmBtn, count===0 && {opacity:0.5}]}
            onPress={() => { if (count > 0) { onConfirm(slots); onClose(); } }}
            disabled={count===0}
          >
            <Feather name="check" size={16} color="#fff"/>
            <Text style={s.confirmBtnTxt}>Valider {count} créneau{count>1?'x':''}</Text>
          </TouchableOpacity>
        </View>

        {/* Time pickers */}
        <TimePicker visible={openPicker}  title="Heure d'ouverture"  value={openTime}
          onConfirm={(t)=>{setOpenTime(t);setOpenPicker(false);}}  onClose={()=>setOpenPicker(false)}/>
        <TimePicker visible={closePicker} title="Heure de fermeture" value={closeTime}
          onConfirm={(t)=>{setCloseTime(t);setClosePicker(false);}} onClose={()=>setClosePicker(false)}/>
        {customPicker && (
          <TimePicker visible title={`${DAY_FULL[customPicker.day]} — ${customPicker.which==='open'?'Ouverture':'Fermeture'}`}
            value={customDays[customPicker.day][customPicker.which]}
            onConfirm={(t)=>{
              setCustomDays(p=>({...p,[customPicker.day]:{...p[customPicker.day],[customPicker.which]:t}}));
              setCustomPicker(null);
            }}
            onClose={()=>setCustomPicker(null)}/>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root:         { flex:1, backgroundColor:'#F8F7F4' },
  header:       { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:20, paddingBottom:16, backgroundColor:'#fff', borderBottomWidth:1, borderBottomColor:'#F3F4F6' },
  closeBtn:     { width:36, height:36, borderRadius:18, backgroundColor:'#F3F4F6', alignItems:'center', justifyContent:'center' },
  title:        { flex:1, fontSize:18, fontWeight:'800', color:'#111827' },
  existingBadge:{ backgroundColor:'#F3F4F6', borderRadius:100, paddingHorizontal:10, paddingVertical:4, fontSize:12, fontWeight:'600', color:'#6B7280' },
  scroll:       { padding:20, gap:20 },
  durationInfo: { flexDirection:'row', gap:8, backgroundColor:'#FEF2EC', borderRadius:12, padding:12, borderWidth:1, borderColor:'#FDDCCA' },
  durationTxt:  { flex:1, fontSize:13, color:'#9A3412', lineHeight:18 },
  bizHoursInfo: { flexDirection:'row', gap:8, backgroundColor:'#EEF2FF', borderRadius:12, padding:12, borderWidth:1, borderColor:'#C7D2FE' },
  bizHoursInfoTxt: { flex:1, fontSize:12, color:'#1E3A5F', lineHeight:17 },
  sectionTitle: { fontSize:13, fontWeight:'700', color:'#374151', marginBottom:10 },
  section:      { gap:10 },
  modeGrid:     { flexDirection:'row', flexWrap:'wrap', gap:8 },
  modeCard:     { width:'18%', minWidth:60, borderRadius:12, padding:10, alignItems:'center', gap:5, backgroundColor:'#fff', borderWidth:1.5, borderColor:'#E5E7EB' },
  modeCardActive:{ borderColor:'#FF6835', backgroundColor:'#FEF2EC' },
  modeEmoji:    { fontSize:22 },
  modeLabel:    { fontSize:10, fontWeight:'600', color:'#374151', textAlign:'center' },
  modeDesc:     { fontSize:12, color:'#9CA3AF', fontStyle:'italic', marginTop:-8 },
  fieldLabel:   { fontSize:11, fontWeight:'600', color:'#9CA3AF', marginBottom:4 },
  timeRow:      { flexDirection:'row', alignItems:'center', gap:10 },
  timeBtn:      { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'#fff', borderRadius:12, paddingHorizontal:14, paddingVertical:11, borderWidth:1.5, borderColor:'#E5E7EB' },
  timeTxt:      { fontSize:15, fontWeight:'700', color:'#111827' },
  timeSep:      { fontSize:14, color:'#9CA3AF', fontWeight:'600' },
  dayCard:      { backgroundColor:'#fff', borderRadius:12, padding:12, gap:8, borderWidth:1, borderColor:'#E5E7EB' },
  dayHeader:    { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  dayName:      { fontSize:14, fontWeight:'500', color:'#9CA3AF' },
  chips:        { flexDirection:'row', flexWrap:'wrap', gap:8 },
  chip:         { paddingHorizontal:14, paddingVertical:8, borderRadius:100, backgroundColor:'#fff', borderWidth:1.5, borderColor:'#E5E7EB' },
  chipActive:   { borderColor:'#FF6835', backgroundColor:'#FEF2EC' },
  chipTxt:      { fontSize:13, fontWeight:'600', color:'#6B7280' },
  qtyRow:       { flexDirection:'row', alignItems:'center', gap:12 },
  qtyBtn:       { width:36, height:36, borderRadius:18, backgroundColor:'#fff', borderWidth:1.5, borderColor:'#E5E7EB', alignItems:'center', justifyContent:'center' },
  qtyVal:       { fontSize:20, fontWeight:'800', color:'#111827', minWidth:30, textAlign:'center' },
  qtyHint:      { fontSize:12, color:'#9CA3AF', flex:1 },
  preview:      { flexDirection:'row', alignItems:'flex-start', gap:10, backgroundColor:'#FEF2EC', borderRadius:14, padding:14, borderWidth:1, borderColor:'#FDDCCA' },
  previewTitle: { fontSize:15, fontWeight:'700', color:'#FF6835' },
  previewSub:   { fontSize:12, color:'#9CA3AF', marginTop:2 },
  footer:       { flexDirection:'row', gap:10, backgroundColor:'#fff', paddingHorizontal:20, paddingTop:12, borderTopWidth:1, borderTopColor:'#F3F4F6' },
  cancelBtn:    { flex:1, alignItems:'center', justifyContent:'center', borderWidth:1.5, borderColor:'#E5E7EB', borderRadius:14, paddingVertical:14 },
  cancelBtnTxt: { fontSize:15, fontWeight:'600', color:'#6B7280' },
  confirmBtn:   { flex:2, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:'#FF6835', borderRadius:14, paddingVertical:14 },
  confirmBtnTxt:{ fontSize:15, fontWeight:'700', color:'#fff' },
});
