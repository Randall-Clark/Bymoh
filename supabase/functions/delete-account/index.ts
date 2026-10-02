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
    const authHeader = req.headers.get('Authorization') ?? '';
    const token      = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      return Response.json({ error: 'Non authentifié' }, { status: 401, headers: cors });
    }

    // ✅ Décoder le JWT pour extraire l'user_id sans appeler /auth/v1/user
    const parts = token.split('.');
    if (parts.length !== 3) {
      return Response.json({ error: 'Token invalide' }, { status: 401, headers: cors });
    }

    let payload: any;
    try {
      payload = JSON.parse(atob(parts[1]));
    } catch {
      return Response.json({ error: 'Token malformé' }, { status: 401, headers: cors });
    }

    // Vérifier l'expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return Response.json({ error: 'Session expirée' }, { status: 401, headers: cors });
    }

    const userId = payload.sub as string;
    if (!userId) {
      return Response.json({ error: 'User ID manquant dans le token' }, { status: 401, headers: cors });
    }

    // Client admin avec service_role (auto-injecté par Supabase)
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Vérifier que l'utilisateur existe bien en DB
    const { data: { user }, error: userErr } = await admin.auth.admin.getUserById(userId);
    if (userErr || !user) {
      return Response.json({ error: 'Utilisateur non trouvé' }, { status: 404, headers: cors });
    }

    console.log('Suppression du compte:', userId);

    // ── Supprimer les données dans l'ordre ───────────────────────────────────

    // Wallets
    const { data: wallets } = await admin.from('wallets').select('id').eq('user_id', userId);
    if (wallets?.length) {
      await admin.from('wallet_transactions').delete().in('wallet_id', wallets.map((w: any) => w.id));
    }
    await admin.from('wallets').delete().eq('user_id', userId);

    // Commandes
    const { data: orders } = await admin.from('orders').select('id').eq('user_id', userId);
    if (orders?.length) {
      await admin.from('order_items').delete().in('order_id', orders.map((o: any) => o.id));
    }
    await admin.from('orders').delete().eq('user_id', userId);

    // Autres
    await admin.from('bookings').delete().eq('user_id', userId);
    await admin.from('reviews').delete().eq('user_id', userId);
    await admin.from('favorites').delete().eq('user_id', userId);
    await admin.from('notifications').delete().eq('user_id', userId);

    // Boutiques
    const { data: businesses } = await admin.from('businesses').select('id').eq('owner_id', userId);
    if (businesses?.length) {
      const ids = businesses.map((b: any) => b.id);
      await admin.from('business_hours').delete().in('business_id', ids);
      await admin.from('services').delete().in('business_id', ids);
      await admin.from('businesses').delete().in('id', ids);
    }

    // Profil
    await admin.from('users').delete().eq('id', userId);

    // Avatar Storage
    await admin.storage.from('avatars').remove(
      ['jpg', 'jpeg', 'png', 'webp'].map((e) => `${userId}.${e}`)
    );

    // ✅ Supprimer le compte Auth
    const { error: deleteErr } = await admin.auth.admin.deleteUser(userId);
    if (deleteErr) console.error('Erreur Auth delete:', deleteErr.message);

    console.log('Compte supprimé:', userId);
    return Response.json({ success: true }, { headers: cors });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Erreur:', msg);
    return Response.json({ error: msg }, { status: 500, headers: cors });
  }
});
