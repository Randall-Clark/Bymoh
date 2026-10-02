// hooks/useRealtimeOrders.ts
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Nom de channel unique par montage via useRef + Date.now()
 * Évite l'erreur "cannot add 'postgres_changes' callbacks after subscribe()"
 */
export function useRealtimeOrders(bizIds: string[]) {
  const qc = useQueryClient();
  const channelName = useRef(
    `realtime-orders-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  ).current;

  useEffect(() => {
    if (!bizIds.length) return;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          console.log('[Realtime] ordre reçu:', payload.eventType);
          qc.invalidateQueries({ queryKey: ['pro-orders'] });
          qc.invalidateQueries({ queryKey: ['dash-curr'] });
          qc.invalidateQueries({ queryKey: ['activity'] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [bizIds.join(',')]);
}

/**
 * FIX — le filtre `business_id` sur `services` n'est valide que si la colonne
 * est dans la publication Realtime. Si tu as l'erreur "invalid column for filter",
 * active REPLICA IDENTITY FULL sur la table `services` dans Supabase :
 *   ALTER TABLE services REPLICA IDENTITY FULL;
 * Ou supprime le filter et laisse le hook invalider toutes les queries du catalog.
 */
export function useRealtimeCatalog(businessId: string) {
  const qc = useQueryClient();
  const channelName = useRef(
    `realtime-catalog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  ).current;

  useEffect(() => {
    if (!businessId) return;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'services',
        // filter retiré si la colonne n'est pas dans la publication —
        // on invalide le cache côté client après chaque événement sur la table
      }, (payload) => {
        qc.invalidateQueries({ queryKey: ['catalog', businessId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [businessId]);
}

/**
 * FIX — filtre `business_id` retiré de wallet_transactions :
 * Supabase Realtime rejette le filtre si la colonne n'est pas dans la
 * publication (erreur "invalid column for filter business_id").
 * Solution propre : écouter tous les changements sur la table et filtrer
 * côté client via le payload, ou activer REPLICA IDENTITY FULL.
 *
 * Pour activer le filtre côté Supabase (recommandé) :
 *   ALTER TABLE wallet_transactions REPLICA IDENTITY FULL;
 * Puis dans le Dashboard → Realtime → Tables → wallet_transactions → activer.
 */
export function useRealtimeWallet(businessId: string) {
  const qc = useQueryClient();
  const channelName = useRef(
    `realtime-wallet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  ).current;

  useEffect(() => {
    if (!businessId) return;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'wallet_transactions',
        // filtre retiré — évite l'erreur "invalid column for filter business_id"
      }, (_payload: any) => {
        // wallet_transactions n'a pas de business_id — on invalide directement.
        // Le filtre par wallet_id nécessiterait un lookup async ; pour l'instant
        // on invalide toutes les queries wallet de cette boutique (coût négligeable).
        qc.invalidateQueries({ queryKey: ['wallet-revenue', businessId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [businessId]);
}
