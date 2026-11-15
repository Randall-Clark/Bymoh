// supabase/functions/cleanup-suspended-businesses/index.ts
//
// Appelée automatiquement chaque nuit par pg_cron (voir migration SQL ci-dessous).
// Peut aussi être appelée manuellement via :
//   supabase functions invoke cleanup-suspended-businesses
//
// Ce qu'elle fait :
// 1. Trouve les boutiques suspendues depuis >= 3 jours
// 2. Vérifie que le versement du portefeuille est finalisé (ou forcé après délai)
// 3. Supprime toutes les données liées en base
// 4. Supprime les fichiers dans le storage Supabase

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUSPENSION_DAYS = 3;

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, // service role pour tout supprimer
  );

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - SUSPENSION_DAYS);

  // ── 1. Trouver les boutiques à supprimer ────────────────────────────────
  const { data: businesses, error: fetchErr } = await supabase
    .from('businesses')
    .select('id, name, wallet_payout_pending')
    .eq('status', 'suspended')
    .lte('suspended_at', cutoff.toISOString());

  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 });
  }
  if (!businesses || businesses.length === 0) {
    return new Response(JSON.stringify({ deleted: 0, message: 'Aucune boutique à supprimer.' }), { status: 200 });
  }

  const results: { id: string; name: string; status: string; note?: string }[] = [];

  for (const biz of businesses) {
    try {
      // ── 2. Vérifier le versement portefeuille ─────────────────────────
      if (biz.wallet_payout_pending) {
        const { data: payout } = await supabase
          .from('wallet_payout_requests')
          .select('status')
          .eq('business_id', biz.id)
          .eq('reason', 'business_suspension')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (payout?.status === 'pending' || payout?.status === 'processing') {
          // Versement pas encore finalisé — marquer pour alerte manuelle
          // mais supprimer quand même après 3 jours (délai respecté côté contrat)
          await supabase.from('wallet_payout_requests')
            .update({ status: 'forced_deletion', note: 'Suppression boutique après délai réglementaire' })
            .eq('business_id', biz.id)
            .eq('reason', 'business_suspension');
        }
      }

      // ── 3. Supprimer les données liées en base ────────────────────────
      await supabase.from('service_availability').delete()
        .in('service_id',
          (await supabase.from('services').select('id').eq('business_id', biz.id)).data?.map((s: any) => s.id) ?? []
        );
      await supabase.from('delivery_zones').delete().eq('business_id', biz.id);
      await supabase.from('business_hours').delete().eq('business_id', biz.id);
      await supabase.from('services').delete().eq('business_id', biz.id);
      await supabase.from('wallet_payout_requests').delete().eq('business_id', biz.id);
      await supabase.from('wallet_accounts').delete().eq('business_id', biz.id);
      await supabase.from('shop_visits').delete().eq('business_id', biz.id);

      // ── 4. Supprimer les fichiers storage ─────────────────────────────
      // Photo de couverture
      const coverExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      await Promise.allSettled(
        coverExts.map(ext =>
          supabase.storage.from('businesses').remove([`covers/${biz.id}.${ext}`])
        )
      );

      // Photos des articles
      const { data: serviceFiles } = await supabase.storage
        .from('businesses')
        .list(`services/${biz.id}`);
      if (serviceFiles && serviceFiles.length > 0) {
        await supabase.storage.from('businesses').remove(
          serviceFiles.map(f => `services/${biz.id}/${f.name}`)
        );
      }

      // ── 5. Supprimer la boutique elle-même ────────────────────────────
      await supabase.from('businesses').delete().eq('id', biz.id);

      results.push({ id: biz.id, name: biz.name, status: 'deleted' });
      console.log(`✅ Boutique supprimée : ${biz.name} (${biz.id})`);

    } catch (err: any) {
      results.push({ id: biz.id, name: biz.name, status: 'error', note: err.message });
      console.error(`❌ Erreur suppression ${biz.id}:`, err.message);
    }
  }

  return new Response(
    JSON.stringify({ deleted: results.filter(r => r.status === 'deleted').length, results }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
