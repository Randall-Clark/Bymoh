// supabase/functions/send-otp/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const COOLDOWN_MS = 60_000;

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    const { phone } = await req.json();

    if (!phone) {
      return Response.json({ error: 'phone requis' }, { status: 400, headers: cors });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ── Vérifier le cooldown via otp_rate_limit ───────────────────────────
    const { data: rateLimit } = await admin
      .from('otp_rate_limit')
      .select('sent_at')
      .eq('phone', phone)
      .maybeSingle();

    if (rateLimit) {
      const elapsed   = Date.now() - new Date(rateLimit.sent_at).getTime();
      const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      if (elapsed < COOLDOWN_MS) {
        return Response.json(
          { error: `Réessayez dans ${remaining}s.`, cooldown: remaining },
          { status: 429, headers: cors }
        );
      }
    }

    // ── Envoyer l'OTP ─────────────────────────────────────────────────────
    const anon = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('APP_ANON_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { error: smsErr } = await anon.auth.signInWithOtp({
      phone,
      options: { shouldCreateUser: true, channel: 'sms' },
    });

    if (smsErr) {
      return Response.json({ error: smsErr.message }, { status: 400, headers: cors });
    }

    // ── Mettre à jour le rate limit (upsert) ─────────────────────────────
    await admin
      .from('otp_rate_limit')
      .upsert({ phone, sent_at: new Date().toISOString() }, { onConflict: 'phone' });

    return Response.json({ success: true }, { headers: cors });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Erreur:', msg);
    return Response.json({ error: msg }, { status: 500, headers: cors });
  }
});
