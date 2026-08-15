// supabase/functions/delete-account/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    // Récupérer le token de l'utilisateur connecté
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return Response.json({ error: 'Non authentifié' }, { status: 401, headers: cors });
    }

    // Client avec le token de l'utilisateur (pour vérifier l'identité)
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Vérifier que l'utilisateur est bien connecté
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return Response.json({ error: 'Utilisateur non trouvé' }, { status: 401, headers: cors });
    }

    const userId = user.id;

    // Client admin pour les suppressions (service_role)
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ── Supprimer toutes les données utilisateur ──────────────────────────────
    // Dans l'ordre pour respecter les FK

    await admin.from('wallet_transactions')
      .delete()
      .in('wallet_id',
        (await admin.from('wallets').select('id').eq('user_id', userId)).data?.map((w: any) => w.id) ?? []
      );

    await admin.from('wallets').delete().eq('user_id', userId);
    await admin.from('order_items')
      .delete()
      .in('order_id',
        (await admin.from('orders').select('id').eq('user_id', userId)).data?.map((o: any) => o.id) ?? []
      );
    await admin.from('orders').delete().eq('user_id', userId);
    await admin.from('bookings').delete().eq('user_id', userId);
    await admin.from('reviews').delete().eq('user_id', userId);
    await admin.from('favorites').delete().eq('user_id', userId);
    await admin.from('notifications').delete().eq('user_id', userId);

    // Supprimer les boutiques et leurs données
    const { data: businesses } = await admin
      .from('businesses')
      .select('id')
      .eq('owner_id', userId);

    if (businesses && businesses.length > 0) {
      const bizIds = businesses.map((b: any) => b.id);
      await admin.from('business_hours').delete().in('business_id', bizIds);
      await admin.from('services').delete().in('business_id', bizIds);
      await admin.from('businesses').delete().in('id', bizIds);
    }

    // Supprimer le profil utilisateur
    await admin.from('users').delete().eq('id', userId);

    // Supprimer l'avatar du storage
    await admin.storage.from('avatars').remove([`${userId}.jpg`, `${userId}.png`, `${userId}.jpeg`]);

    // ✅ Supprimer le compte Supabase Auth (irréversible)
    const { error: deleteErr } = await admin.auth.admin.deleteUser(userId);
    if (deleteErr) {
      console.error('Erreur suppression Auth:', deleteErr.message);
      // Ne pas bloquer — les données sont déjà supprimées
    }

    return Response.json({ success: true }, { headers: cors });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Erreur delete-account:', msg);
    return Response.json({ error: msg }, { status: 500, headers: cors });
  }
});
