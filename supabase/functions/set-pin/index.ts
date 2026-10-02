// supabase/functions/set-pin/index.ts
// Définit le NIP d'un utilisateur via service_role (bypass "same password" check)
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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return Response.json({ error: 'Non authentifié' }, { status: 401, headers: cors });
    }

    const { pin } = await req.json();
    if (!pin || pin.length < 4) {
      return Response.json({ error: 'NIP invalide' }, { status: 400, headers: cors });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Vérifier l'identité
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) {
      return Response.json({ error: 'Session invalide' }, { status: 401, headers: cors });
    }

    // ✅ admin.updateUserById bypass la vérification "même mot de passe"
    const { error: updateErr } = await admin.auth.admin.updateUserById(
      user.id,
      { password: pin }
    );

    if (updateErr) {
      return Response.json({ error: updateErr.message }, { status: 400, headers: cors });
    }

    // Marquer le NIP comme configuré en DB
    await admin.from('users')
      .update({ pin_hash: 'configured' })
      .eq('id', user.id);

    return Response.json({ success: true }, { headers: cors });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Erreur set-pin:', msg);
    return Response.json({ error: msg }, { status: 500, headers: cors });
  }
});
